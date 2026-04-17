using System.Text.Json;
using DocumentationBackend.Services;
using Xunit;

namespace DocumentationBackend.Tests;

public sealed class AiDirectFilledDocumentValidatorTests
{
    [Fact]
    public void FindRemainingPlaceholders_detects_common_markers()
    {
        const string text = "Nom : (X) — CIN () — date XX/XX/2026 — compte (XXXX) et {{cin}} + ___";
        var hits = AiDirectFilledDocumentValidator.FindRemainingPlaceholders(text);
        Assert.Contains("(X)", hits);
        Assert.Contains("()", hits);
        Assert.Contains("XX/XX/2026", hits);
        Assert.Contains("(XXXX)", hits);
        Assert.Contains("{{cin}}", hits);
        Assert.Contains("___", hits);
    }

    [Fact]
    public void MergeFlattenedData_form_overwrites_db_same_key()
    {
        var db = JsonDocument.Parse("""{"nom":"A","nested":{"x":1}}""").RootElement;
        var form = JsonDocument.Parse("""{"nom":"B"}""").RootElement;
        var m = AiDirectFilledDocumentValidator.MergeFlattenedData(db, form);
        Assert.Equal("B", m["nom"]);
        Assert.Equal("1", m["nested.x"]);
    }

    [Fact]
    public void FindCriticalDataNotReflectedInOutput_fails_when_cin_missing_from_output()
    {
        var merged = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["cin"] = "AB123456",
            ["nom_complet"] = "Jean Dupont",
        };
        var output = "Attestation pour Jean Dupont.";
        var failures = AiDirectFilledDocumentValidator.FindCriticalDataNotReflectedInOutput(merged, output);
        Assert.NotEmpty(failures);
        Assert.Contains(failures, s => s.Contains("cin", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void FindUserListedResidualPlaceholders_detects_X_and_empty_parens()
    {
        const string text = "Pièce (X) et () restants";
        var hits = AiDirectFilledDocumentValidator.FindUserListedResidualPlaceholders(text);
        Assert.Contains("(X)", hits);
        Assert.Contains("()", hits);
    }

    [Fact]
    public void FindCriticalDataNotReflectedInOutput_ok_when_values_present()
    {
        var merged = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["cin"] = "AB123456",
            ["date_document"] = "2026-04-16",
        };
        const string output = "CIN AB123456, établi le 16/04/2026 à Casablanca.";
        Assert.Empty(AiDirectFilledDocumentValidator.FindCriticalDataNotReflectedInOutput(merged, output));
    }
}
