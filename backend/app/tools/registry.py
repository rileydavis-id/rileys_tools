from dataclasses import dataclass, field
from typing import List
from fastapi import APIRouter


@dataclass
class ToolEndpointDoc:
    method: str
    path: str
    summary: str


@dataclass
class ToolMetadata:
    id: str
    name: str
    slug: str
    category: str
    description: str
    version: str
    status: str = "active"  # "active" | "beta" | "planned"
    icon: str = "box"
    tags: List[str] = field(default_factory=list)
    endpoints: List[ToolEndpointDoc] = field(default_factory=list)


class ToolRegistry:
    """Central registry for all Python tools hosted on the shared Render service."""

    def __init__(self) -> None:
        self._tools: List[tuple[ToolMetadata, APIRouter]] = []

    def register(self, metadata: ToolMetadata, router: APIRouter) -> None:
        self._tools.append((metadata, router))

    @property
    def entries(self) -> List[tuple[ToolMetadata, APIRouter]]:
        return list(self._tools)

    def list_metadata(self) -> List[dict]:
        result = []
        for meta, _ in self._tools:
            result.append(
                {
                    "id": meta.id,
                    "name": meta.name,
                    "slug": meta.slug,
                    "category": meta.category,
                    "description": meta.description,
                    "version": meta.version,
                    "status": meta.status,
                    "icon": meta.icon,
                    "tags": meta.tags,
                    "endpoints": [
                        {
                            "method": ep.method,
                            "path": ep.path,
                            "summary": ep.summary,
                        }
                        for ep in meta.endpoints
                    ],
                }
            )
        return result


registry = ToolRegistry()
