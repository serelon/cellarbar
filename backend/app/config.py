from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://cellarbar:cellarbar_dev@localhost:5432/cellarbar"

    model_config = {"env_file": ".env"}


settings = Settings()
