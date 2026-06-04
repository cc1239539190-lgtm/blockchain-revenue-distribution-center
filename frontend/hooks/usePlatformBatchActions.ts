"use client";

import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { creatorRevenueDistributorAbi, revenueBatchRegistryAbi } from "@/lib/contracts";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import type { RuntimeConfig } from "@/types/contract-config";
import type { PlatformActivationPreviewResponse } from "@/types/domain";

type BatchAction = "resume" | "pause" | "close";

export function usePlatformBatchActions(config: RuntimeConfig) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const { data: hash, isPending, writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: config.chainId });

  async function submitBatchAction(action: BatchAction, payload: { batchIdHex: `0x${string}` }) {
    try {
      setActionError(null);

      if (action === "resume") {
        return await writeContractAsync({
          address: config.batchRegistryAddress,
          abi: revenueBatchRegistryAbi,
          functionName: "resumeBatch",
          args: [payload.batchIdHex]
        });
      }

      if (action === "pause") {
        return await writeContractAsync({
          address: config.batchRegistryAddress,
          abi: revenueBatchRegistryAbi,
          functionName: "pauseBatch",
          args: [payload.batchIdHex]
        });
      }

      return await writeContractAsync({
        address: config.batchRegistryAddress,
        abi: revenueBatchRegistryAbi,
        functionName: "closeBatch",
        args: [payload.batchIdHex]
      });
    } catch (error) {
      const context = action === "resume" ? "batch-publish" : action === "pause" ? "batch-pause" : "batch-close";
      setActionError(getFriendlyErrorMessage(error, context));
      throw error;
    }
  }

  async function submitBatchActivation(payload: PlatformActivationPreviewResponse) {
    try {
      setActionError(null);

      return await writeContractAsync({
        address: config.distributorAddress,
        abi: creatorRevenueDistributorAbi,
        functionName: "activateBatchWithFunding",
        args: [
          payload.batchIdHex,
          payload.merkleRoot,
          payload.metadataHash,
          payload.claimIdHex,
          payload.monthLabel,
          payload.billId,
          BigInt(payload.grossAmountWei),
          payload.creator
        ],
        value: BigInt(payload.grossAmountWei)
      });
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, "batch-publish"));
      throw error;
    }
  }

  async function waitForReceipt(txHash: `0x${string}`) {
    setIsConfirming(true);
    try {
      if (!publicClient) {
        throw new Error("Public client 未就绪，请确认钱包已连接且网络正确。");
      }

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 90_000,
        pollingInterval: 2_000
      });

      if (receipt.status !== "success") {
        throw new Error("链上执行失败，交易已被回滚。请检查链上状态。");
      }

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        status: receipt.status
      };
    } finally {
      setIsConfirming(false);
    }
  }

  return {
    txHash: hash,
    isPending,
    isConfirming,
    isSuccess: false,
    actionError,
    submitBatchAction,
    submitBatchActivation,
    waitForReceipt
  };
}
