# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY Directory.Build.props global.json MockApi.sln ./
COPY src/MockApi.Api/MockApi.Api.csproj src/MockApi.Api/
COPY src/MockApi.Core/MockApi.Core.csproj src/MockApi.Core/
COPY src/MockApi.Data/MockApi.Data.csproj src/MockApi.Data/
COPY src/MockApi.Workers/MockApi.Workers.csproj src/MockApi.Workers/
COPY tests/MockApi.UnitTests/MockApi.UnitTests.csproj tests/MockApi.UnitTests/
COPY tests/MockApi.IntegrationTests/MockApi.IntegrationTests.csproj tests/MockApi.IntegrationTests/
COPY tests/MockApi.ContractTests/MockApi.ContractTests.csproj tests/MockApi.ContractTests/

RUN dotnet restore MockApi.sln

COPY . .

FROM build AS test
RUN dotnet test MockApi.sln -c Release --no-restore --nologo

FROM build AS publish
RUN dotnet publish src/MockApi.Api/MockApi.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true

EXPOSE 8080

COPY --from=publish /app/publish .

USER app

ENTRYPOINT ["dotnet", "MockApi.Api.dll"]
