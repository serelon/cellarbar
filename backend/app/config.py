from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://cellarbar:cellarbar_dev@localhost:5432/cellarbar"

    # OIDC (all set → OIDC login replaces profile-pick; unset → local profile-pick mode)
    oidc_issuer: str | None = None
    oidc_client_id: str | None = None
    oidc_client_secret: str | None = None
    oidc_redirect_url: str | None = None

    # Shared secret for the MCP server's service-token auth path
    mcp_service_token: str | None = None

    model_config = {"env_file": ".env"}

    @property
    def oidc_enabled(self) -> bool:
        return bool(self.oidc_issuer and self.oidc_client_id and self.oidc_client_secret)


settings = Settings()
