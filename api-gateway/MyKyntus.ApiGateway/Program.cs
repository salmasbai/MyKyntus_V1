var builder = WebApplication.CreateBuilder(args);

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.MapGet("/health", () => Results.Json(new { status = "Healthy", service = "api-gateway" }));
app.MapGet("/healthz", () => Results.Json(new { status = "Healthy", service = "api-gateway" }));

app.MapReverseProxy();

app.MapGet("/", () => Results.Json(new
{
    service = "MyKyntus.ApiGateway",
    message = "Passerelle YARP. Proxy vers le microservice Documentation.",
    tryThese = new[] { "/health", "/api/documentation/health" },
}));

app.Run();
