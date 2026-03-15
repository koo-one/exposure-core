import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GraphSnapshot, GraphNode } from "@/types";
import { resolveRootNode, calculateNodeContext } from "@/lib/graph";

interface UseAssetDataProps {
  id: string;
  chain?: string;
  protocol?: string;
  focus?: string;
}

const parseParamList = (raw: string | null): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

export function useAssetData(props: UseAssetDataProps | null) {
  const { id, chain, protocol, focus } = props || {};
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [graphData, setGraphData] = useState<GraphSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tvl, setTvl] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [focusRootNodeId, setFocusRootNodeId] = useState<string | null>(null);
  const [focusStack, setFocusStack] = useState<string[]>([]);
  const [pageTitle, setPageTitle] = useState<string>(id || "");
  const [isOthersView, setIsOthersView] = useState(false);
  const [othersChildrenIds, setOthersChildrenIds] = useState<string[]>([]);
  const latestRequestIdRef = useRef(0);

  const focusTrail = useMemo(
    () => parseParamList(searchParams.get("focusTrail")),
    [searchParams],
  );
  const othersParamIds = useMemo(
    () => parseParamList(searchParams.get("others")),
    [searchParams],
  );

  const rootNode = useMemo(() => {
    if (!graphData || !id) return null;
    return resolveRootNode(graphData.nodes, id, chain);
  }, [graphData, id, chain]);

  const syncViewParams = useCallback(
    (
      nextFocusId: string | null,
      nextFocusTrail: string[],
      nextOthersIds: string[],
      mode: "push" | "replace",
    ) => {
      if (!pathname) return;

      const params = new URLSearchParams(searchParams.toString());
      const normalizedRootId = rootNode?.id.trim().toLowerCase() ?? "";
      const normalizedNextFocusId = nextFocusId?.trim().toLowerCase() ?? "";

      if (
        !normalizedNextFocusId ||
        normalizedNextFocusId === normalizedRootId
      ) {
        params.delete("focus");
      } else {
        params.set("focus", nextFocusId ?? "");
      }

      if (nextFocusTrail.length > 0) {
        params.set("focusTrail", nextFocusTrail.join(","));
      } else {
        params.delete("focusTrail");
      }

      if (nextOthersIds.length > 0) {
        params.set("others", nextOthersIds.join(","));
      } else {
        params.delete("others");
      }

      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      const currentQuery = searchParams.toString();
      const currentUrl = currentQuery
        ? `${pathname}?${currentQuery}`
        : pathname;

      if (nextUrl === currentUrl) return;

      const navigate = mode === "push" ? router.push : router.replace;
      navigate(nextUrl, { scroll: false });
    },
    [pathname, rootNode?.id, router, searchParams],
  );

  useEffect(() => {
    if (!id) {
      setGraphData(null);
      setSelectedNode(null);
      setFocusRootNodeId(null);
      setFocusStack([]);
      setOthersChildrenIds([]);
      setIsOthersView(false);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      const isLatestRequest = () => latestRequestIdRef.current === requestId;

      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (protocol) queryParams.set("protocol", protocol);
        if (chain) queryParams.set("chain", chain);

        const response = await fetch(
          `/api/graph/${encodeURIComponent(id.trim().toLowerCase())}${
            queryParams.size ? `?${queryParams.toString()}` : ""
          }`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }

        const json: GraphSnapshot = await response.json();
        if (!isLatestRequest()) return;

        setGraphData(json);

        const resolvedRoot = resolveRootNode(json.nodes, id, chain);
        if (resolvedRoot) {
          if (resolvedRoot.tvlUsd) {
            setTvl(resolvedRoot.tvlUsd);
          } else {
            const { totalOutgoingUsd } = calculateNodeContext(
              resolvedRoot,
              json.edges,
            );
            setTvl(totalOutgoingUsd);
          }
        } else {
          setTvl(null);
        }
      } catch (error) {
        if (isLatestRequest()) {
          console.error(error);
          setGraphData(null);
        }
      } finally {
        if (isLatestRequest()) {
          setLoading(false);
        }
      }
    };

    void fetchData();
  }, [id, chain, protocol]);

  useEffect(() => {
    if (!graphData || !rootNode) return;

    const nodesById = new Map(
      graphData.nodes.map(
        (node) => [node.id.trim().toLowerCase(), node] as const,
      ),
    );
    const normalizedFocus = focus?.trim().toLowerCase();
    const focusNode = normalizedFocus
      ? nodesById.get(normalizedFocus)
      : undefined;
    const nextSelectedNode = focusNode || rootNode;

    const normalizedSelectedId = nextSelectedNode.id.trim().toLowerCase();
    const normalizedRootId = rootNode.id.trim().toLowerCase();
    const nextFocusStack: string[] = [];
    for (const rawId of focusTrail) {
      const node = nodesById.get(rawId.trim().toLowerCase());
      if (!node) continue;
      const normalizedNodeId = node.id.trim().toLowerCase();
      if (
        normalizedNodeId === normalizedRootId ||
        normalizedNodeId === normalizedSelectedId ||
        nextFocusStack.some((id) => id.toLowerCase() === normalizedNodeId)
      ) {
        continue;
      }
      nextFocusStack.push(node.id);
    }

    const nextOthersIds = othersParamIds.filter((rawId) =>
      nodesById.has(rawId.trim().toLowerCase()),
    );

    setSelectedNode(nextSelectedNode);
    setFocusRootNodeId(nextSelectedNode.id);
    setFocusStack(nextFocusStack);
    setIsOthersView(nextOthersIds.length > 0);
    setOthersChildrenIds(nextOthersIds);
    setPageTitle(nextSelectedNode.name);
  }, [focus, focusTrail, othersParamIds, graphData, rootNode]);

  const applyLocalDrilldown = useCallback(
    (node: GraphNode) => {
      const currentFocus = focusRootNodeId ?? rootNode?.id ?? null;
      const normalizedCurrentFocus = currentFocus?.trim().toLowerCase() ?? "";
      const normalizedRootId = rootNode?.id.trim().toLowerCase() ?? "";

      const nextFocusStack =
        !currentFocus ||
        !normalizedCurrentFocus ||
        normalizedCurrentFocus === normalizedRootId
          ? focusStack
          : [...focusStack, currentFocus];

      setSelectedNode(node);
      setFocusRootNodeId(node.id);
      setFocusStack(nextFocusStack);
      setIsOthersView(false);
      setOthersChildrenIds([]);
      syncViewParams(node.id, nextFocusStack, [], "push");
    },
    [focusRootNodeId, focusStack, rootNode, syncViewParams],
  );

  const handleBackOneStep = useCallback(() => {
    if (!graphData) return;

    if (isOthersView) {
      setIsOthersView(false);
      setOthersChildrenIds([]);
      syncViewParams(focusRootNodeId, focusStack, [], "replace");
      return;
    }

    const prevId = focusStack[focusStack.length - 1];
    if (!prevId) {
      if (rootNode && focusRootNodeId !== rootNode.id) {
        setFocusRootNodeId(rootNode.id);
        setSelectedNode(rootNode);
        setFocusStack([]);
        syncViewParams(rootNode.id, [], [], "replace");
      }
      return;
    }

    const nextFocusStack = focusStack.slice(0, -1);
    setFocusStack(nextFocusStack);
    setFocusRootNodeId(prevId);
    setIsOthersView(false);
    setOthersChildrenIds([]);
    syncViewParams(prevId, nextFocusStack, [], "replace");

    const prevNode = graphData.nodes.find((node) => node.id === prevId);
    if (prevNode) setSelectedNode(prevNode);
  }, [
    graphData,
    focusRootNodeId,
    focusStack,
    isOthersView,
    rootNode,
    syncViewParams,
  ]);

  const resetToRoot = useCallback(() => {
    if (!rootNode) return;
    setIsOthersView(false);
    setOthersChildrenIds([]);
    setFocusStack([]);
    setFocusRootNodeId(rootNode.id);
    setSelectedNode(rootNode);
    syncViewParams(rootNode.id, [], [], "replace");
  }, [rootNode, syncViewParams]);

  const jumpToFocus = useCallback(
    (targetId: string) => {
      if (!graphData) return;
      const normalizedTarget = targetId.trim().toLowerCase();
      const targetNode = graphData.nodes.find(
        (node) => node.id.toLowerCase() === normalizedTarget,
      );
      if (!targetNode) return;

      setIsOthersView(false);
      setOthersChildrenIds([]);

      if (rootNode && normalizedTarget === rootNode.id.toLowerCase()) {
        setFocusStack([]);
        setFocusRootNodeId(rootNode.id);
        setSelectedNode(rootNode);
        syncViewParams(rootNode.id, [], [], "replace");
        return;
      }

      const indexInStack = focusStack.findIndex(
        (stackId) => stackId.toLowerCase() === normalizedTarget,
      );
      const nextFocusStack =
        indexInStack >= 0 ? focusStack.slice(0, indexInStack) : focusStack;

      setFocusStack(nextFocusStack);
      setFocusRootNodeId(targetNode.id);
      setSelectedNode(targetNode);
      syncViewParams(targetNode.id, nextFocusStack, [], "replace");
    },
    [graphData, focusStack, rootNode, syncViewParams],
  );

  const showOthersView = useCallback(
    (childIds: string[]) => {
      const nextOthersIds = childIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      if (nextOthersIds.length === 0) return;

      setIsOthersView(true);
      setOthersChildrenIds(nextOthersIds);
      syncViewParams(focusRootNodeId, focusStack, nextOthersIds, "push");
    },
    [focusRootNodeId, focusStack, syncViewParams],
  );

  return {
    graphData,
    loading,
    tvl,
    selectedNode,
    setSelectedNode,
    focusRootNodeId,
    setFocusRootNodeId,
    focusStack,
    pageTitle,
    rootNode,
    applyLocalDrilldown,
    handleBackOneStep,
    resetToRoot,
    jumpToFocus,
    showOthersView,
    isAtAssetRoot: focusRootNodeId === rootNode?.id,
    isOthersView,
    othersChildrenIds,
  };
}
