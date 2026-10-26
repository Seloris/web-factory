using System.Reflection;
using RosterComp.Api.Common;
using RosterComp.Api.Features.Health;
using RosterComp.Application;
using RosterComp.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// A run of the app gives the port of its slot in PORT; appsettings gives the base ports (Demo: the demo's).
builder.WebHost.UseUrls($"http://localhost:{builder.Configuration["PORT"]}");
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
// A body that does not bind (malformed JSON) throws, so the handler answers it with problem details like any other 400.
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
builder.Services.AddOpenApi();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is missing"));

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

var api = app.MapGroup("").AddEndpointFilter<ValidationFilter>();
api.MapHealth();

// The handoff's build-time document generation runs this file up to RunAsync: it needs no database.
if (Assembly.GetEntryAssembly()?.GetName().Name != "GetDocument.Insider")
{
    await app.Services.MigrateDatabaseAsync(seedDemo: app.Environment.IsEnvironment("Demo"));
}
await app.RunAsync();

public partial class Program;
