using System.Net;
using System.Net.Http.Json;
using RosterComp.Api.Features.Health;

namespace RosterComp.Api.Tests.Health;

public sealed class HealthEndpointsTests(ApiFactory api) : ApiTest(api)
{
    [Fact]
    public async Task GetHealth_Should_ReturnOkWithTheCurrentTime_When_Called()
    {
        // Arrange
        var now = new DateTimeOffset(2026, 10, 17, 12, 0, 0, TimeSpan.Zero);
        Api.Time.Set(now);

        // Act
        var response = await Client.GetAsync("/health", CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>(CT);
        body.ShouldBe(new HealthResponse("ok", now));
    }
}
