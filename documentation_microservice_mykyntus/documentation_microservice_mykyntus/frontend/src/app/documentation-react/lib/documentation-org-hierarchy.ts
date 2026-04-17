import type { DirectoryUserDto } from '../../shared/models/api.models';
import type { DocumentationRole } from '../interfaces/documentation-role';

export interface HierarchyDrillSelection {
  managerId?: string;
  coachId?: string;
  pilotId?: string;
}

export function displayDirectoryUserLabel(user: DirectoryUserDto): string {
  const fullName = `${user.prenom ?? ''} ${user.nom ?? ''}`.trim();
  return fullName || user.email || user.id;
}

function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? '').trim().toLowerCase();
  const right = (b ?? '').trim().toLowerCase();
  return left !== '' && left === right;
}

function byRole(users: DirectoryUserDto[], role: string): DirectoryUserDto[] {
  return users.filter((user) => user.role.trim().toLowerCase() === role);
}

export function listManagersUnderRp(users: DirectoryUserDto[], rpId: string): DirectoryUserDto[] {
  return byRole(users, 'manager').filter((user) => sameId(user.rpId, rpId));
}

export function listCoachesUnderManager(users: DirectoryUserDto[], managerId: string): DirectoryUserDto[] {
  return byRole(users, 'coach').filter((user) => sameId(user.managerId, managerId));
}

export function listPilotesUnderCoach(users: DirectoryUserDto[], coachId: string): DirectoryUserDto[] {
  return byRole(users, 'pilote').filter((user) => sameId(user.coachId, coachId));
}

export function drillSelectOptions(
  role: DocumentationRole,
  users: DirectoryUserDto[],
  viewerUserId: string,
  drill: HierarchyDrillSelection,
): {
  managers: { value: string; label: string }[];
  coaches: { value: string; label: string }[];
  pilots: { value: string; label: string }[];
} {
  // #region agent log
  fetch('http://127.0.0.1:7721/ingest/64a12fe4-8b14-42fa-b884-e01871ac05cf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bd69fa'},body:JSON.stringify({sessionId:'bd69fa',runId:'pre-fix',hypothesisId:'H1-H4',location:'documentation-org-hierarchy.ts:47',message:'drillSelectOptions entry',data:{role,usersCount:users.length,viewerUserIdPresent:!!viewerUserId,drill},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const toOption = (user: DirectoryUserDto) => ({ value: user.id, label: displayDirectoryUserLabel(user) });
  const managers =
    role === 'RP'
      ? listManagersUnderRp(users, viewerUserId).map(toOption)
      : [];
  const coaches =
    role === 'Manager'
      ? listCoachesUnderManager(users, viewerUserId).map(toOption)
      : role === 'RP' && drill.managerId
        ? listCoachesUnderManager(users, drill.managerId).map(toOption)
        : [];
  const pilotSourceCoachId = role === 'Manager' ? drill.coachId : role === 'RP' ? drill.coachId : viewerUserId;
  const pilots =
    role === 'Coach'
      ? listPilotesUnderCoach(users, viewerUserId).map(toOption)
      : role === 'Manager' || role === 'RP'
        ? pilotSourceCoachId
          ? listPilotesUnderCoach(users, pilotSourceCoachId).map(toOption)
          : []
        : [];
  // #region agent log
  fetch('http://127.0.0.1:7721/ingest/64a12fe4-8b14-42fa-b884-e01871ac05cf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bd69fa'},body:JSON.stringify({sessionId:'bd69fa',runId:'pre-fix',hypothesisId:'H4',location:'documentation-org-hierarchy.ts:67',message:'drillSelectOptions output',data:{role,managers:managers.length,coaches:coaches.length,pilots:pilots.length,managerId:drill.managerId??null,coachId:drill.coachId??null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { managers, coaches, pilots };
}

export function visibleEmployeeIdsForRole(
  role: DocumentationRole,
  viewer: DirectoryUserDto | null,
  users: DirectoryUserDto[],
  drill: HierarchyDrillSelection = {},
): Set<string> | null {
  // #region agent log
  fetch('http://127.0.0.1:7721/ingest/64a12fe4-8b14-42fa-b884-e01871ac05cf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bd69fa'},body:JSON.stringify({sessionId:'bd69fa',runId:'pre-fix',hypothesisId:'H2-H3-H4',location:'documentation-org-hierarchy.ts:80',message:'visibleEmployeeIdsForRole entry',data:{role,viewerId:viewer?.id??null,usersCount:users.length,drill},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (role === 'RH' || role === 'Admin' || role === 'Audit') {
    return null;
  }
  if (!viewer?.id) {
    return new Set();
  }
  if (role === 'Pilote') {
    return new Set([viewer.id]);
  }

  if (role === 'Coach') {
    return new Set(listPilotesUnderCoach(users, viewer.id).map((user) => user.id));
  }

  if (role === 'Manager') {
    if (!drill.coachId) {
      return new Set();
    }
    const coaches = listCoachesUnderManager(users, viewer.id);
    if (!coaches.some((coach) => sameId(coach.id, drill.coachId))) {
      return new Set();
    }
    const pilots = listPilotesUnderCoach(users, drill.coachId);
    return new Set(
      (drill.pilotId ? pilots.filter((pilot) => sameId(pilot.id, drill.pilotId)) : pilots).map((pilot) => pilot.id),
    );
  }

  if (role === 'RP') {
    if (!drill.managerId || !drill.coachId) {
      return new Set();
    }
    const managers = listManagersUnderRp(users, viewer.id);
    if (!managers.some((manager) => sameId(manager.id, drill.managerId))) {
      return new Set();
    }
    const coaches = listCoachesUnderManager(users, drill.managerId);
    if (!coaches.some((coach) => sameId(coach.id, drill.coachId))) {
      return new Set();
    }
    const pilots = listPilotesUnderCoach(users, drill.coachId);
    return new Set(
      (drill.pilotId ? pilots.filter((pilot) => sameId(pilot.id, drill.pilotId)) : pilots).map((pilot) => pilot.id),
    );
  }

  return new Set();
}
