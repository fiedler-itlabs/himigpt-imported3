import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  createContract, 
  deleteContractWithChildren,
  getContractHierarchy,
  getMainContracts,
  getChildContracts,
  updateContractParent,
  getContractById
} from './db';
import { expandContractIdsWithChildren, buildSourcePath } from './contractHierarchyHelper';

describe('Hierarchical Contract System', () => {
  let parentContractId: number;
  let childContract1Id: number;
  let childContract2Id: number;

  beforeAll(async () => {
    // Create test contracts
    const parent = await createContract({
      name: 'Test AOK Bayern Orthopädie',
      pdfUrl: 'https://example.com/parent.pdf',
      pdfKey: 'test/parent.pdf',
      uploadedBy: 1,
      status: 'ready',
      insuranceCompany: 'AOK Bayern',
      productArea: 'Orthopädie',
      parentContractId: null,
      contractType: 'main',
      productGroups: null,
      displayOrder: 0,
    });
    parentContractId = parent.id;

    const child1 = await createContract({
      name: 'Test Produktgruppe 4',
      pdfUrl: 'https://example.com/child1.pdf',
      pdfKey: 'test/child1.pdf',
      uploadedBy: 1,
      status: 'ready',
      insuranceCompany: 'AOK Bayern',
      productArea: 'Orthopädie',
      parentContractId: parentContractId,
      contractType: 'productgroup',
      productGroups: '4',
      displayOrder: 1,
    });
    childContract1Id = child1.id;

    const child2 = await createContract({
      name: 'Test Preisliste 2024',
      pdfUrl: 'https://example.com/child2.pdf',
      pdfKey: 'test/child2.pdf',
      uploadedBy: 1,
      status: 'ready',
      insuranceCompany: 'AOK Bayern',
      productArea: 'Orthopädie',
      parentContractId: parentContractId,
      contractType: 'pricelist',
      productGroups: null,
      displayOrder: 2,
    });
    childContract2Id = child2.id;
  });

  afterAll(async () => {
    // Cleanup: delete parent (should cascade to children)
    await deleteContractWithChildren(parentContractId);
  });

  it('should get main contracts only', async () => {
    const mainContracts = await getMainContracts();
    
    // Should include our test parent
    const testParent = mainContracts.find(c => c.id === parentContractId);
    expect(testParent).toBeDefined();
    expect(testParent?.parentContractId).toBeNull();
    
    // Should NOT include children
    const hasChildren = mainContracts.some(c => 
      c.id === childContract1Id || c.id === childContract2Id
    );
    expect(hasChildren).toBe(false);
  });

  it('should get child contracts of a parent', async () => {
    const children = await getChildContracts(parentContractId);
    
    expect(children.length).toBe(2);
    expect(children.some(c => c.id === childContract1Id)).toBe(true);
    expect(children.some(c => c.id === childContract2Id)).toBe(true);
  });

  it('should get contract hierarchy (parent + children)', async () => {
    const hierarchy = await getContractHierarchy(parentContractId);
    
    expect(hierarchy.parent).toBeDefined();
    expect(hierarchy.parent?.id).toBe(parentContractId);
    expect(hierarchy.children.length).toBe(2);
  });

  it('should expand contract IDs with children', async () => {
    const expanded = await expandContractIdsWithChildren([parentContractId]);
    
    // Should include parent + 2 children = 3 total
    expect(expanded.length).toBe(3);
    expect(expanded).toContain(parentContractId);
    expect(expanded).toContain(childContract1Id);
    expect(expanded).toContain(childContract2Id);
  });

  it('should build hierarchical source path', async () => {
    // Parent should show just its name
    const parentPath = await buildSourcePath(parentContractId, 'Test AOK Bayern Orthopädie');
    expect(parentPath).toBe('Test AOK Bayern Orthopädie');
    
    // Child should show "Parent > Child"
    const childPath = await buildSourcePath(childContract1Id, 'Test Produktgruppe 4');
    expect(childPath).toContain('Test AOK Bayern Orthopädie');
    expect(childPath).toContain('>');
    expect(childPath).toContain('Test Produktgruppe 4');
  });

  it('should update contract parent', async () => {
    // Create a standalone contract
    const standalone = await createContract({
      name: 'Test Standalone',
      pdfUrl: 'https://example.com/standalone.pdf',
      pdfKey: 'test/standalone.pdf',
      uploadedBy: 1,
      status: 'ready',
      parentContractId: null,
      contractType: 'main',
      productGroups: null,
      displayOrder: 0,
    });

    // Update it to be a child of our parent
    await updateContractParent(standalone.id, parentContractId);

    // Verify it's now a child
    const updated = await getContractById(standalone.id);
    expect(updated?.parentContractId).toBe(parentContractId);

    // Cleanup
    await deleteContractWithChildren(standalone.id);
  });

  it('should prevent 3-level hierarchy', async () => {
    // Try to make a child contract a parent (would create grandchild)
    const grandchild = await createContract({
      name: 'Test Grandchild',
      pdfUrl: 'https://example.com/grandchild.pdf',
      pdfKey: 'test/grandchild.pdf',
      uploadedBy: 1,
      status: 'ready',
      parentContractId: null,
      contractType: 'main',
      productGroups: null,
      displayOrder: 0,
    });

    // This should throw an error
    await expect(
      updateContractParent(grandchild.id, childContract1Id)
    ).rejects.toThrow();

    // Cleanup
    await deleteContractWithChildren(grandchild.id);
  });

  it('should cascade delete children when parent is deleted', async () => {
    // Create a temporary parent with child
    const tempParent = await createContract({
      name: 'Temp Parent',
      pdfUrl: 'https://example.com/temp-parent.pdf',
      pdfKey: 'test/temp-parent.pdf',
      uploadedBy: 1,
      status: 'ready',
      parentContractId: null,
      contractType: 'main',
      productGroups: null,
      displayOrder: 0,
    });

    const tempChild = await createContract({
      name: 'Temp Child',
      pdfUrl: 'https://example.com/temp-child.pdf',
      pdfKey: 'test/temp-child.pdf',
      uploadedBy: 1,
      status: 'ready',
      parentContractId: tempParent.id,
      contractType: 'extension',
      productGroups: null,
      displayOrder: 0,
    });

    // Delete parent (should cascade to child)
    await deleteContractWithChildren(tempParent.id);

    // Verify both are gone
    const parentGone = await getContractById(tempParent.id);
    const childGone = await getContractById(tempChild.id);
    
    expect(parentGone).toBeUndefined();
    expect(childGone).toBeUndefined();
  });
});
