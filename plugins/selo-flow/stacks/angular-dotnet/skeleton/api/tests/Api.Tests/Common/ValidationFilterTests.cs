using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.DependencyInjection;
using {{namespace}}.Api.Common;

namespace {{namespace}}.Api.Tests.Common;

public sealed class ValidationFilterTests
{
    public sealed record Probe(string Name);

    public sealed class ProbeValidator : AbstractValidator<Probe>
    {
        public ProbeValidator() => RuleFor(p => p.Name).NotEmpty();
    }

    [Fact]
    public async Task Filter_Should_ReturnValidationProblem_When_AnArgumentIsInvalid()
    {
        // Arrange
        var context = Arrange(new Probe(""));

        // Act
        var result = await new ValidationFilter().InvokeAsync(context, _ => ValueTask.FromResult<object?>("next"));

        // Assert
        var problem = result.ShouldBeOfType<ValidationProblem>().ProblemDetails;
        problem.Errors.ShouldContainKey("Name");
        problem.Extensions["code"].ShouldBe("validation_failed");
    }

    [Fact]
    public async Task Filter_Should_CallTheEndpoint_When_EveryArgumentIsValid()
    {
        // Arrange
        var context = Arrange(new Probe("Ada"));

        // Act
        var result = await new ValidationFilter().InvokeAsync(context, _ => ValueTask.FromResult<object?>("next"));

        // Assert
        result.ShouldBe("next");
    }

    private static EndpointFilterInvocationContext Arrange(Probe probe)
    {
        var services = new ServiceCollection().AddSingleton<IValidator<Probe>, ProbeValidator>().BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services };
        return EndpointFilterInvocationContext.Create(http, probe, TestContext.Current.CancellationToken);
    }
}
