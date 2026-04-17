import type { DocumentationRole } from '../interfaces/documentation-role';
import {
  visibleEmployeeIdsForRole,
  type HierarchyDrillSelection,
} from './documentation-org-hierarchy';
import type { DirectoryUserDto } from '../../shared/models/api.models';

export function filterByEmployeeScope<T extends { employeeId?: string }>(
  items: T[],
  role: DocumentationRole,
  viewer: DirectoryUserDto | null,
  users: DirectoryUserDto[],
  drill?: HierarchyDrillSelection,
): T[] {
  // #region agent log
  fetch('http://127.0.0.1:7721/ingest/64a12fe4-8b14-42fa-b884-e01871ac05cf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bd69fa'},body:JSON.stringify({sessionId:'bd69fa',runId:'pre-fix',hypothesisId:'H1-H3',location:'documentation-filters.ts:15',message:'filterByEmployeeScope entry',data:{role,itemsCount:items.length,usersCount:users.length,viewerId:viewer?.id??null,hasDrill:!!drill},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const allowed = visibleEmployeeIdsForRole(role, viewer, users, drill ?? {});
  // #region agent log
  fetch('http://127.0.0.1:7721/ingest/64a12fe4-8b14-42fa-b884-e01871ac05cf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bd69fa'},body:JSON.stringify({sessionId:'bd69fa',runId:'pre-fix',hypothesisId:'H2-H3',location:'documentation-filters.ts:18',message:'filterByEmployeeScope resolved allowed',data:{role,scopeMode:allowed===null?'all':'restricted',allowedCount:allowed===null?null:allowed.size},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (allowed === null) return items;
  return items.filter((i) => i.employeeId && allowed.has(i.employeeId));
}

export type { HierarchyDrillSelection };
