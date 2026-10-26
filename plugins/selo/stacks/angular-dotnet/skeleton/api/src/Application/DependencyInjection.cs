using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace {{namespace}}.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;
        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);
        // Every use case's nested Handler class (CreateOrder.Handler), injected into its endpoint.
        foreach (var handler in assembly.GetTypes().Where(t => t is { Name: "Handler", IsClass: true, IsAbstract: false, IsNested: true }))
        {
            services.AddScoped(handler);
        }
        return services;
    }
}
