import { useState, useEffect, useMemo, useCallback } from 'react';
import { GraphSnapshot, GraphNode } from '@/types';
import { resolveRootNode, calculateNodeContext } from '@/lib/graph';

interface UseAssetDataProps {
  id: string;
  chain?: string;
  protocol?: string;
  focus?: string;
}

export function useAssetData({ id, chain, protocol, focus }: UseAssetDataProps) {
  const [graphData, setGraphData] = useState<GraphSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tvl, setTvl] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [focusRootNodeId, setFocusRootNodeId] = useState<string | null>(null);
  const [focusStack, setFocusStack] = useState<string[]>([]);
  const [pageTitle, setPageTitle] = useState<string>(id);

  const formatChainLabel = useCallback((value: string | undefined): string => {
    if (!value) return "Unknown";
    const slug = value.trim().toLowerCase();

    switch (slug) {
      case "eth":
      case "ethereum":
        return "Ethereum";
      case "arb":
      case "arbitrum":
        return "Arbitrum";
      case "op":
      case "optimism":
        return "Optimism";
      case "base":
        return "Base";
      case "polygon":
      case "matic":
        return "Polygon";
      case "hyper":
      case "hyperliquid":
        return "Hyper";
      case "uni":
      case "unichain":
        return "Unichain";
      case "global":
        return "Global";
      default:
        return slug.length > 0
          ? slug[0].toUpperCase() + slug.slice(1)
          : "Unknown";
    }
  }, []);

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

        const rootNode = resolveRootNode(json.nodes, id, chain);

        if (rootNode) {
          const normalizedFocus = focus?.toLowerCase();
          const focusNode = normalizedFocus
            ? json.nodes.find((n) => n.id.toLowerCase() === normalizedFocus)
            : undefined;

          const initial = focusNode || rootNode;
          setSelectedNode(initial);
          setFocusRootNodeId(initial.id);
          setFocusStack([]);

          const chainLabel = formatChainLabel(rootNode.chain ?? chain);
          const titleNode = focusNode || rootNode;
          setPageTitle(`${chainLabel} ${titleNode.name}`);

          if (rootNode.tvlUsd) {
            setTvl(rootNode.tvlUsd);
          } else {
            const { totalOutgoingUsd } = calculateNodeContext(
              rootNode,
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

  const applyLocalDrilldown = useCallback((node: GraphNode) => {
    const currentFocus = focusRootNodeId ?? rootNode?.id ?? null;
    if (!currentFocus || currentFocus === node.id) {
      setFocusRootNodeId(node.id);
      return;
    }

    setFocusStack((prev) => [...prev, currentFocus]);
    setFocusRootNodeId(node.id);
  }, [focusRootNodeId, rootNode]);

  const handleBackOneStep = useCallback(() => {
    if (!graphData) return;

    const prevId = focusStack[focusStack.length - 1];
    if (!prevId) return;

    setFocusStack((prev) => prev.slice(0, -1));
    setFocusRootNodeId(prevId);

    const prevNode = graphData.nodes.find((n) => n.id === prevId);
    if (prevNode) setSelectedNode(prevNode);
  }, [graphData, focusStack]);

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
    isAtAssetRoot: focusStack.length === 0,
  };
}
