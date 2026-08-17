/**
 * Helper functions for contract hierarchy in RAG system
 */

import { getContractById, getChildContracts } from './db';

/**
 * Expand contract IDs to include all children
 * If a contract is a parent, automatically include all its sub-contracts
 * 
 * Example:
 * Input: [1, 5] where 1 has children [2, 3, 4]
 * Output: [1, 2, 3, 4, 5]
 */
export async function expandContractIdsWithChildren(contractIds: number[]): Promise<number[]> {
  const expandedIds = new Set<number>();
  
  for (const id of contractIds) {
    // Add the contract itself
    expandedIds.add(id);
    
    // Check if it has children
    const children = await getChildContracts(id);
    for (const child of children) {
      expandedIds.add(child.id);
    }
  }
  
  return Array.from(expandedIds);
}

/**
 * Build hierarchical source path for display
 * Example: "AOK Bayern Orthopädie > Produktgruppe 4"
 */
export async function buildSourcePath(contractId: number, contractName: string): Promise<string> {
  const contract = await getContractById(contractId);
  
  if (!contract) {
    return contractName;
  }
  
  // If this is a child contract, get parent name
  if (contract.parentContractId) {
    const parent = await getContractById(contract.parentContractId);
    if (parent) {
      return `${parent.name} > ${contractName}`;
    }
  }
  
  return contractName;
}

/**
 * Get priority score for contract type (for conflict resolution)
 * Higher score = higher priority
 */
export function getContractTypePriority(contractType: string): number {
  const priorities = {
    extension: 4,    // Highest priority (overrides everything)
    pricelist: 3,    // Price updates
    productgroup: 2, // Product-specific info
    regional: 1,     // Regional variants
    main: 0,         // Base contract (lowest priority)
  };
  
  return priorities[contractType as keyof typeof priorities] ?? 0;
}

/**
 * Sort sources by contract type priority and date
 * Used for conflict resolution when same info appears in multiple contracts
 */
export async function sortSourcesByPriority(
  sources: Array<{ contractId: number; createdAt?: Date }>
): Promise<Array<{ contractId: number; createdAt?: Date }>> {
  // Fetch contract details for all sources
  const sourcesWithContracts = await Promise.all(
    sources.map(async (source) => {
      const contract = await getContractById(source.contractId);
      return {
        ...source,
        contract,
        priority: contract ? getContractTypePriority(contract.contractType) : 0,
      };
    })
  );
  
  // Sort by priority (desc), then by date (desc)
  sourcesWithContracts.sort((a, b) => {
    // First by priority
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    
    // Then by date (newer first)
    const dateA = a.contract?.createdAt?.getTime() || 0;
    const dateB = b.contract?.createdAt?.getTime() || 0;
    return dateB - dateA;
  });
  
  return sourcesWithContracts.map(({ contract, priority, ...source }) => source);
}
