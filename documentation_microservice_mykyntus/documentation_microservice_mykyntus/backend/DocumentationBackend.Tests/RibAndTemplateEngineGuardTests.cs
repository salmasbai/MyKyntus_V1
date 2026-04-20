using DocumentationBackend.Api;
using DocumentationBackend.Application.Abstractions;
using DocumentationBackend.Configuration;
using DocumentationBackend.Services;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace DocumentationBackend.Tests;

public sealed class RibAndTemplateEngineGuardTests
{
    private static IRibValidationService Rib() =>
        new RibValidationService(Options.Create(new RibValidationOptions { MinDigits = 14, MaxDigits = 24 }));

    private static TemplateEngineService CreateEngine()
    {
        var norm = new TemplatePlaceholderNormalizationService(Rib());
        return new TemplateEngineService(norm, Rib());
    }

    [Theory]
    [InlineData("12345678901234", true)]
    [InlineData("1234 5678 9012 3456 7890 1234", true)]
    [InlineData("1234567890123", false)]
    [InlineData("1234567890123456789012345", false)]
    public void RibValidationService_digits_only_length_bounds(string raw, bool expected)
    {
        var svc = Rib();
        Assert.Equal(expected, svc.IsValidRibDigits(raw));
    }

    [Fact]
    public void ValidateValues_rejects_rib_when_too_short()
    {
        var engine = CreateEngine();
        var vars = new[]
        {
            new DetectedTemplateVariable("rib", "text", true, Rib().DigitsOnlyValidationPattern),
        };
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["rib"] = "123" };
        var r = engine.ValidateValues(vars, values);
        Assert.False(r.IsValid);
        Assert.Contains("rib", r.InvalidFormat);
    }

    [Fact]
    public void ListStructuralResiduals_detects_unresolved_curly_placeholder()
    {
        var engine = CreateEngine();
        const string template = "CIN : {{cin}}";
        var merged = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["nom"] = "Test" };
        var hits = engine.ListStructuralResidualsAfterRender(template, merged);
        Assert.Contains(hits, h => h.Contains("{{cin}}", StringComparison.Ordinal));
    }

    [Fact]
    public void ListStructuralResiduals_empty_when_marqueur_x_fills_x_marker()
    {
        var engine = CreateEngine();
        const string template = "Pièce (X) pour M. Dupont.";
        var merged = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["marqueur_x"] = "AB123456",
        };
        var hits = engine.ListStructuralResidualsAfterRender(template, merged);
        Assert.DoesNotContain("(X)", hits, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AiDirectFill_returns_503_when_ia_unavailable()
    {
        var mockAi = new Mock<IAiTemplateContentGenerator>();
        mockAi.Setup(a => a.IsAvailableAsync(It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var orchestrator = new AiDirectDocumentFillOrchestrator(mockAi.Object);
        var body = new AiDirectDocumentFillRequest
        {
            Template = "Texte avec (X)",
        };
        var outcome = await orchestrator.FillAsync(
            body,
            AiDirectFillValidationPolicy.GenerateDocumentAiUi,
            CancellationToken.None);
        Assert.False(outcome.Success);
        Assert.Equal(503, outcome.ErrorStatusCode);
    }
}
