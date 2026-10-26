using System.Reflection;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.OpenApi;
using RosterComp.Api.Common;
using RosterComp.Api.Features.Catalogue;
using RosterComp.Api.Features.Health;
using RosterComp.Api.Features.Players;
using RosterComp.Api.Features.Roster;
using RosterComp.Application;
using RosterComp.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// A run of the app gives the port of its slot in PORT; appsettings gives the base ports (Demo: the demo's).
builder.WebHost.UseUrls($"http://localhost:{builder.Configuration["PORT"]}");
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
// A body that does not bind (malformed JSON) throws, so the handler answers it with problem details like any other 400.
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
// Numbers are numbers on the wire, so the OpenAPI document (and the front's generated models) types them as such.
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);
builder.Services.AddOpenApi(options =>
    // A use case's nested types share their names (CreateOrder.Command, UpdateOrder.Command): the schema takes the outer name too.
    options.CreateSchemaReferenceId = info => info.Type.DeclaringType is { } outer
        ? outer.Name + info.Type.Name
        : OpenApiOptions.CreateDefaultSchemaReferenceId(info));
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is missing"));

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

// No sign-in: one shared roster, so every route is public.
var api = app.MapGroup("").AddEndpointFilter<ValidationFilter>();
api.MapHealth();
api.MapCatalogue();
api.MapPlayers();
api.MapRoster();

// The handoff's build-time document generation runs this file up to RunAsync: it needs no database.
if (Assembly.GetEntryAssembly()?.GetName().Name != "GetDocument.Insider")
{
    await app.Services.MigrateDatabaseAsync(seedDemo: app.Environment.IsEnvironment("Demo"));
}
await app.RunAsync();

public partial class Program;
