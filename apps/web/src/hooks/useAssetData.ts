import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraphSnapshot, GraphNode } from "@/types";
import { resolveRootNode, calculateNodeContext } from "@/lib/graph";
import { formatChainLabel } from "@/utils/formatters";

interface UseAssetDataProps {
  id: string;
  chain?: string;
  protocol?: string;
  focus?: string;
}

export function useAssetData({
  id,
  chain,
  protocol,
  focus,
}: UseAssetDataProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [graphData, setGraphData] = useState<GraphSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tvl, setTvl] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [focusRootNodeId, setFocusRootNodeId] = useState<string | null>(null);
  const [focusStack, setFocusStack] = useState<string[]>([]);
  const [pageTitle, setPageTitle] = useState<string>(id);

  // Others view state
  const [isOthersView, setIsOthersView] = useState(false);
  const [othersChildrenIds, setOthersChildrenIds] = useState<string[]>([]);

  // Synchronize focusRootNodeId with URL
  useEffect(() => {
    if (!focusRootNodeId) return;

    const params = new URLSearchParams(searchParams.toString());
    if (focusRootNodeId === rootNode?.id) {
      params.delete("focus");
    } else {
      params.set("focus", focusRootNodeId);
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [focusRootNodeId]);

  // Reset Others view when focusRootNodeId changes
  useEffect(() => {
    setIsOthersView(false);
    setOthersChildrenIds([]);
  }, [focusRootNodeId]);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
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
        setGraphData(json);

        const resolvedRoot = resolveRootNode(json.nodes, id, chain);

        if (resolvedRoot) {
          const normalizedFocus = focus?.toLowerCase();
          const focusNode = normalizedFocus
            ? json.nodes.find((n) => n.id.toLowerCase() === normalizedFocus)
            : undefined;

          const initial = focusNode || resolvedRoot;
          setSelectedNode(initial);
          setFocusRootNodeId(initial.id);
          setFocusStack([]);

          const chainLabel = formatChainLabel(resolvedRoot.chain ?? chain);
          const titleNode = focusNode || resolvedRoot;
          setPageTitle(`${chainLabel} ${titleNode.name}`);

          if (resolvedRoot.tvlUsd) {
            setTvl(resolvedRoot.tvlUsd);
          } else {
            const { totalOutgoingUsd } = calculateNodeContext(
              resolvedRoot,
              json.edges,
            );
            setTvl(totalOutgoingUsd);
          }
        }
      } catch (error) {
        console.error(error);
        setGraphData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, chain, focus, protocol, formatChainLabel]);

  const rootNode = useMemo(() => {
    if (!graphData) return null;
    return resolveRootNode(graphData.nodes, id, chain);
  }, [graphData, id, chain]);

  const applyLocalDrilldown = useCallback(
    (node: GraphNode) => {
      const currentFocus = focusRootNodeId ?? rootNode?.id ?? null;
      if (!currentFocus || currentFocus === node.id) {
        setFocusRootNodeId(node.id);
        return;
      }

      setFocusStack((prev) => [...prev, currentFocus]);
      setFocusRootNodeId(node.id);
    },
    [focusRootNodeId, rootNode],
  );

  const handleBackOneStep = useCallback(() => {
    if (!graphData) return;

    if (isOthersView) {
      setIsOthersView(false);
      setOthersChildrenIds([]);
      return;
    }

    const prevId = focusStack[focusStack.length - 1];
    if (!prevId) {
      // If stack is empty but we are focused on something that isn't the root, reset to root
      if (rootNode && focusRootNodeId !== rootNode.id) {
        setFocusRootNodeId(rootNode.id);
        setSelectedNode(rootNode);
      }
      return;
    }

    setFocusStack((prev) => prev.slice(0, -1));
    setFocusRootNodeId(prevId);

    const prevNode = graphData.nodes.find((n) => n.id === prevId);
    if (prevNode) setSelectedNode(prevNode);
  }, [graphData, focusStack, focusRootNodeId, rootNode, isOthersView]);

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
    isAtAssetRoot: focusRootNodeId === rootNode?.id,
    isOthersView,
    setIsOthersView,
    othersChildrenIds,
    setOthersChildrenIds,
  };
}
