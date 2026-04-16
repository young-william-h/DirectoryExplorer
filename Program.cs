namespace TestProject {
    public class Program {
        public static void Main(string[] args) {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddControllers();

            var app = builder.Build();

            // Configure the HTTP request pipeline.

            app.UseHttpsRedirection();

            app.UseStaticFiles();

            app.MapControllers();

            app.UseDefaultFiles(); // Enables serving index.html
            app.UseStaticFiles();  // Enables serving files from wwwroot

            app.Run();
        }
    }
}