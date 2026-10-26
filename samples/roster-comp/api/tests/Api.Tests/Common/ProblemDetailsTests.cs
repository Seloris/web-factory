using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using RosterComp.Api.Common;
using RosterComp.Domain.Common;

namespace RosterComp.Api.Tests.Common;

public sealed class ProblemDetailsTests(ApiFactory api) : ApiTest(api)
{
    [Fact]
    public async Task UnknownRoute_Should_ReturnNotFoundProblemDetails_When_NoEndpointMatches()
    {
        // Act
        var response = await Client.GetAsync("/does-not-exist", CT);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/problem+json");
    }

    [Theory]
    [InlineData("not-found", 404, "not_found")]
    [InlineData("forbidden", 403, "forbidden")]
    [InlineData("conflict", 409, "order_locked")]
    [InlineData("business-rule", 422, "order_too_late")]
    public async Task Handler_Should_WriteProblemDetailsWithTheCode_When_TheExceptionIsExpected(string kind, int status, string code)
    {
        // Arrange
        Exception exception = kind switch
        {
            "not-found" => new NotFoundException("Order", 7),
            "forbidden" => new ForbiddenException(),
            "conflict" => new ConflictException("order_locked", "The order is locked"),
            _ => new DomainException("order_too_late", "The order can no longer change"),
        };
        var (handler, http) = Arrange();

        // Act
        var isHandled = await handler.TryHandleAsync(http, exception, CT);

        // Assert
        isHandled.ShouldBeTrue();
        http.Response.StatusCode.ShouldBe(status);
        http.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(http.Response.Body, cancellationToken: CT);
        body.RootElement.GetProperty("code").GetString().ShouldBe(code);
        body.RootElement.GetProperty("detail").GetString().ShouldBe(exception.Message);
    }

    [Fact]
    public async Task Handler_Should_LeaveTheException_When_ItIsNotExpected()
    {
        // Arrange
        var (handler, http) = Arrange();

        // Act
        var isHandled = await handler.TryHandleAsync(http, new InvalidOperationException("boom"), CT);

        // Assert
        isHandled.ShouldBeFalse();
    }

    private (ProblemDetailsExceptionHandler Handler, HttpContext Http) Arrange()
    {
        var handler = new ProblemDetailsExceptionHandler(Api.Services.GetRequiredService<IProblemDetailsService>());
        var http = new DefaultHttpContext { RequestServices = Api.Services };
        http.Response.Body = new MemoryStream();
        return (handler, http);
    }
}
