using DocumentationBackend.Configuration;
using DocumentationBackend.Services;
using Microsoft.Extensions.Options;
using Xunit;

namespace DocumentationBackend.Tests;

public sealed class TemplatePlaceholderNormalizationServiceTests
{
    private static IRibValidationService CreateRib() =>
        new RibValidationService(Options.Create(new RibValidationOptions()));

    private readonly TemplatePlaceholderNormalizationService _service = new(CreateRib());

    [Fact]
    public void NormalizeKey_removes_accents_spaces_and_special_chars()
    {
        var normalized = _service.NormalizeKey("Nom Employé");
        Assert.Equal("nom_employe", normalized);
    }

    [Fact]
    public void ExtractPlaceholders_maps_human_variants_to_single_canonical_keys()
    {
        const string template = """
Je soussigné (Nom Employé), titulaire du CIN (numero cin),
confirme le salaire (salaire-net) et le prénom {{prenom}}.
""";

        var matches = _service.ExtractPlaceholders(template);

        Assert.Contains(matches, m => m.RawToken == "(Nom Employé)" && m.CanonicalKey == "nom_employe");
        Assert.Contains(matches, m => m.RawToken == "(numero cin)" && m.CanonicalKey == "numero_cin");
        Assert.Contains(matches, m => m.RawToken == "(salaire-net)" && m.CanonicalKey == "salaire_brut");
        Assert.Contains(matches, m => m.CanonicalKey == "prenom_employe");
    }

    [Fact]
    public void RenderContent_replaces_human_placeholders_and_curly_placeholders()
    {
        var engine = new TemplateEngineService(_service, CreateRib());
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["nom_employe"] = "Dupont",
            ["numero_cin"] = "AB123456",
            ["date_document"] = "2026-04-16",
        };

        const string template = "Je soussigné (Nom Employé), CIN (numero cin), établi le {{date_document}}.";

        var rendered = engine.RenderContent(template, values);

        Assert.Contains("Dupont", rendered);
        Assert.Contains("AB123456", rendered);
        Assert.Contains("16/04/2026", rendered);
        Assert.DoesNotContain("(Nom Employé)", rendered);
        Assert.DoesNotContain("(numero cin)", rendered);
        Assert.DoesNotContain("{{date_document}}", rendered);
    }
}
