using Geniusek.Kernel.Logging;
using Microsoft.Extensions.DependencyInjection;
using Yandex.Cloud.Functions;

namespace Geniusek.Yandex.Functions;

public abstract class BaseFunction<TInput, TOutput>: BaseLoggingObject
{
    public BaseFunction(ILogger? logger = null)
        : base(logger ?? new DefaultLogger(Environment.GetEnvironmentVariable("LogLevel") ?? string.Empty))
    {
        DependenciesProvider = ConfigureDependencies();
    }

    public async Task<TOutput> Execute(TInput input, Context context)
    {
        try
        {
            Debug("Input", input);

            var output = await HandleAsync(input, context);
            Debug("Output", output);
            return output;
        }
        catch (Exception e)
        {
            // NOTE: hiding sensitive information from the client
            Error(e);
            // NOTE: failing with 500
            throw new Exception("Internal server error.");
        }
    }

    protected abstract Task<TOutput> HandleAsync(TInput input, Context context);

    protected string GetEnvVariable(string key)
    {
        return Environment.GetEnvironmentVariable(key) ?? string.Empty;
    }
    protected T GetDependency<T>()
    {
        return DependenciesProvider.GetRequiredService<T>();
    }
    protected virtual IServiceCollection ConfigureDependencies(IServiceCollection dependencies)
    {
        return dependencies;
    }

    private IServiceProvider DependenciesProvider { get; }
    private IServiceProvider ConfigureDependencies()
    {
        var initialDependencies = new ServiceCollection();
        initialDependencies.AddSingleton<ILogger>(LoggerLog.Instance);

        var dependencies = ConfigureDependencies(initialDependencies);
        return dependencies.BuildServiceProvider();
    }
}
