namespace {{namespace}}.Api.Tests;

/// <summary>
/// The tests' clock: fixed at <see cref="Epoch"/> until a test sets it, never the real time.
/// </summary>
public sealed class TestTimeProvider : TimeProvider
{
    public static readonly DateTimeOffset Epoch = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private DateTimeOffset now = Epoch;

    public override DateTimeOffset GetUtcNow() => now;

    public void Set(DateTimeOffset value) => now = value;
}
