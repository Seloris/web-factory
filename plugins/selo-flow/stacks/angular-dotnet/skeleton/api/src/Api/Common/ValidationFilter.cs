using FluentValidation;

namespace {{namespace}}.Api.Common;

/// <summary>
/// Runs the FluentValidation validator of every endpoint argument that has one: a failure answers 400 before the handler runs.
/// </summary>
public sealed class ValidationFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        foreach (var argument in context.Arguments.OfType<object>())
        {
            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (context.HttpContext.RequestServices.GetService(validatorType) is not IValidator validator)
            {
                continue;
            }
            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            if (!result.IsValid)
            {
                return TypedResults.ValidationProblem(
                    result.ToDictionary(),
                    extensions: new Dictionary<string, object?> { ["code"] = "validation_failed" });
            }
        }
        return await next(context);
    }
}
