"use client";

import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import type { CreatorClaimPackage } from "@/types/domain";
import { creatorRevenueDistributorAbi } from "@/lib/contracts";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import type { RuntimeConfig } from "@/types/contract-config";

export function useClaimFlow(config: RuntimeConfig) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const { data: hash, isPending, writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: config.chainId });

  async function submitClaim(claimPackage: CreatorClaimPackage) {
    try {
      setActionError(null);
      return await writeContractAsync({
        address: config.distributorAddress,
        abi: creatorRevenueDistributorAbi,
        functionName: "claim",
        args: [
          claimPackage.batchIdHex,
          claimPackage.claimIdHex,
          claimPackage.creator,
          BigInt(claimPackage.grossAmount),
          claimPackage.recipients,
          claimPackage.bps.map((value) => Number(value)),
          claimPackage.merkleProof
        ]
      });
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, "claim"));
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
    receipt: undefined,
    submitClaim,
    waitForReceipt
  };
}
