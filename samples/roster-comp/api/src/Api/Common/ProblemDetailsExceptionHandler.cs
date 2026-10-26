using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using RosterComp.Domain.Common;

namespace RosterComp.Api.Common;

/// <summary>
/// Turns an expected exception into a problem details response (RFC 9457) with its <c>code</c>; any other one stays a 500.
/// </summary>
public sealed class ProblemDetailsExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        (int Status, string Code)? mapped = exception switch
        {
            BadHttpRequestException e => (e.StatusCode, "bad_request"),
            NotFoundException e => (StatusCodes.Status404NotFound, e.Code),
            ForbiddenException e => (StatusCodes.Status403Forbidden, e.Code),
            ConflictException e => (StatusCodes.Status409Conflict, e.Code),
            DomainException e => (StatusCodes.Status422UnprocessableEntity, e.Code),
            _ => null,
        };
        if (mapped is not { } problem)
        {
            return false;
        }
        httpContext.Response.StatusCode = problem.Status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = problem.Status,
                Detail = exception.Message,
                Extensions = { ["code"] = problem.Code },
            },
        });
    }
}
