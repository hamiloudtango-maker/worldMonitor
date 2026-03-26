from pydantic import BaseModel, Field


class QueryPart(BaseModel):
    type: str = Field(..., description="topic | entity | keyword")
    value: str
    aliases: list[str] = []
    scope: str = "title_and_content"


class QueryLayer(BaseModel):
    operator: str = "AND"  # AND | OR | NOT
    parts: list[QueryPart] = []


class FeedQuery(BaseModel):
    layers: list[QueryLayer] = []


class AIConfig(BaseModel):
    relevance_threshold: int = 60
    enrichment_enabled: bool = True
    summary_enabled: bool = True


class AIFeedCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str = Field("", max_length=1000)
    query: FeedQuery = FeedQuery()
    ai_config: AIConfig = AIConfig()


class AIFeedUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    query: FeedQuery | None = None
    ai_config: AIConfig | None = None
    status: str | None = None


class SourceAdd(BaseModel):
    url: str
    name: str = Field(..., max_length=200)
    lang: str | None = None
    tier: int = 3
    source_type: str | None = None
    country: str | None = None
    continent: str | None = None
    origin: str = "catalog"


class SourceToggle(BaseModel):
    enabled: bool


class CatalogEntry(BaseModel):
    name: str
    url: str
    lang: str | None = None
    tier: int = 3
    source_type: str | None = None
    country: str | None = None
    continent: str | None = None
    thematic: str | None = None


class ValidateUrlRequest(BaseModel):
    url: str


class ValidateUrlResponse(BaseModel):
    valid: bool
    feeds_found: list[dict] = []
    error: str | None = None


class SuggestSourcesRequest(BaseModel):
    query: FeedQuery
    limit: int = 20


class ParseQueryRequest(BaseModel):
    text: str


class AIFeedResponse(BaseModel):
    id: str
    name: str
    description: str | None
    query: dict | None
    ai_config: dict | None
    status: str
    is_template: bool
    source_count: int
    result_count: int
    created_at: str
    updated_at: str


class AIFeedSourceResponse(BaseModel):
    id: str
    url: str
    name: str
    lang: str | None
    tier: int
    source_type: str | None
    country: str | None
    continent: str | None
    origin: str
    enabled: bool


class AIFeedResultResponse(BaseModel):
    id: str
    article_url: str
    title: str
    source_name: str
    published_at: str | None
    relevance_score: float
    entities: list | None
    summary: str | None
    threat_level: str | None
    category: str | None
    fetched_at: str
