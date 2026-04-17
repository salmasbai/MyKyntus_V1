FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY MyKyntus.ApiGateway.csproj .
RUN dotnet restore MyKyntus.ApiGateway.csproj
COPY . .
RUN dotnet publish MyKyntus.ApiGateway.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENTRYPOINT ["dotnet", "MyKyntus.ApiGateway.dll"]
