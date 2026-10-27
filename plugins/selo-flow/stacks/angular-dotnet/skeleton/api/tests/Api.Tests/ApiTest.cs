namespace {{namespace}}.Api.Tests;

/// <summary>
/// The base of every endpoint test class: the class's <see cref="ApiFactory"/>, a client on it, the database reset before each test.
/// </summary>
public abstract class ApiTest(ApiFactory api) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    protected ApiFactory Api { get; } = api;

    protected HttpClient Client { get; } = api.CreateClient();

    protected static CancellationToken CT => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() => await Api.ResetAsync(CT);

    public ValueTask DisposeAsync()
    {
        Client.Dispose();
        GC.SuppressFinalize(this);
        return ValueTask.CompletedTask;
    }
}
