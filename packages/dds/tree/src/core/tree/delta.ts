/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { Brand, Opaque } from "../../util";
import { ITreeCursorSynchronous } from "./cursor";
import { FieldKey, Value } from "./types";

/**
 * This format describes changes that must be applied to a document tree in order to update it.
 * Instances of this format are generated based on incoming changesets and consumed by a view layer (e.g., Forest) to
 * update itself.
 *
 * Because this format is only meant for updating document state, it does not fully represent user intentions.
 * For example, if some edit A inserts content and some subsequent edit B deletes that content, then a Delta that
 * represents the state update for these two edits would not include the insertion and deletion.
 * For the same reason, this format is also not fit to be rebased in the face of concurrent changes.
 * Instead this format is used to describe the end product of rebasing user intentions over concurrent edits.
 *
 * This format is self-contained in the following ways:
 *
 * 1. It uses integer indices (offsets, technically) to describe necessary changes.
 * As such, it does not rely on document nodes being randomly accessible by ID.
 *
 * 2. This format does not require historical information in order to apply the changes it describes.
 * For example, if a user undoes the deletion of a subtree, then the Delta generated for the undo edit will contain all
 * information necessary to re-create the subtree from scratch.
 *
 * This format can be generated from any Changeset without having access to the current document state.
 *
 * This format is meant to serve as the lowest common denominator to represent state changes resulting from any kind
 * of operation on any kind of field.
 * This means all such operations must be expressible in terms of this format.
 *
 * Future work:
 * - Define where and how field-specific and operation-specific metadata is meant to be represented.
 * - Add a move table to describe the src and dst paths of move operations.
 *
 * Within the above design constrains, this format is designed with the following goals in mind:
 *
 * 1. Make it easy to walk both a document tree and the delta tree to apply the changes described in the delta
 * with a minimum amount of backtracking over the contents of the tree.
 * This a boon for both code simplicity and performance.
 *
 * 2. Make the format terse.
 *
 * 3. Make the format uniform.
 *
 * These goals are reflected in the following design choices (this is very much optional reading for users of this
 * format):
 *
 * 1. All marks that apply to field elements are represented in a single linear structure where marks that affect later
 * element of the document field appear after marks that affect earlier elements of the document field.
 *
 * If the marks were not ordered in this fashion then a consumer would need to backtrack within the document field.
 *
 * If the marks were represented in multiple such linear structures then it would be necessary to either:
 * - backtrack when iterating over one structure fully, then the next
 * - maintain a pointer within each such linear structure and advance them in lock-step (like in a k-way merge-sort but
 * more fiddly because of the offsets).
 *
 * The drawback of this design choice is that it relies heavily on polymorphism:
 * for each mark encountered a reader has to check which kind of mark it is.
 * This is a source of code and time complexity in the reader code and adds a memory overhead to the format since each
 * mark has to carry a tag field to announce what kind of mark it is.
 *
 * 2. `MoveIn` marks in inserted portions of the document are inlined in their corresponding `ProtoField`.
 *
 * If the MoveIn marks were represented in a separate sub-structure (like they are under moved-in portions of the tree)
 * then the representation would forced to describe the path to them (in the form field keys and field offsets) from
 * the root of the inserted portion of the tree.
 * This would have two adverse effects:
 * - It would make the format less terse since this same path information would be redundant (it is already included in
 * the ProtoTree).
 * - It would lead the consumer of the format first build the inserted subtree, then traverse it again from its root to
 * apply the relevant `MoveIn` marks.
 *
 *
 * 3. Modifications of deleted and moved-out nodes are represented using modify marks within `Delete` and `MoveOut`
 * marks.
 * This is in opposition to a structure where the fact that a modified node is being deleted or moved-out would
 * be represented a `Modify` mark like so:
 * ```typescript
 * interface ModifyAndDelete {
 *   type: typeof MarkType.ModifyAndDelete;
 *   fields: FieldMap<PositionedMarks<ModifyDeleted | MoveOut>>;
 * }
 * interface ModifyAndMoveOut {
 *   type: typeof MarkType.ModifyAndMoveOut;
 *   moveId: MoveId;
 *   fields: FieldMap<PositionedMarks<ModifyMovedOut | MoveOut>>;
 * }
 * export interface Delete {
 *   type: typeof MarkType.Delete;
 *   count: number;
 * }
 * export interface MoveOut {
 *   type: typeof MarkType.MoveOut;
 *   count: number;
 *   moveId: MoveId;
 * }
 * ```
 * Note the absence of modify information in `Delete` and `MoveOut` above.
 *
 * The benefit of the chosen representation over the alternative are two-fold:
 * - It leads to less splitting of moved and deleted ranges of nodes.
 * - It makes the format more uniform since modifications to moved-in subtrees must be represented with modifications
 * marks within a `MoveIn` mark.
 *
 * 4. `MoveIn` marks are represented in the location where the content being moved resides in the input context that
 * the delta is applied to, and `MoveOut` marks are represented in the location where the content being moved should
 * reside after the delta is applied.
 *
 * The alternative would be to allow such marks to appear in temporary locations (e.g., in field "bar" for a
 * transaction that moves content from "foo" to "bar" then moves that same content from "bar" to "baz").
 * This makes the format less terse and harder to reason about.
 *
 * 5. MoveIn marks are not inlined within `ProtoField`s.
 *
 * Inlining them would force the consuming code to detect `MoveIn` marks within the `ProtoField` and handle them
 * within the context of the insert.
 * This would be cumbersome because either the code that is responsible for consuming the `ProtoField` would need to
 * be aware of and have the context to handle `MoveIn`, or some caller of that code would need to find and extract such
 * `MoveIn` marks ahead to calling that code.
 */

/**
 * Represents the change made to a document.
 * Immutable, therefore safe to retain for async processing.
 * @alpha
 */
export type Root<TTree = ProtoNode> = FieldMarks<TTree>;

/**
 * The default representation for inserted content.
 * @alpha
 */
export type ProtoNode = ITreeCursorSynchronous;

/**
 * Represents a change being made to a part of the tree.
 * @alpha
 */
export type Mark<TTree = ProtoNode> =
	| Skip
	| Modify<TTree>
	| Delete
	| MoveOut
	| MoveIn
	| Insert<TTree>
	| ModifyAndDelete<TTree>
	| ModifyAndMoveOut<TTree>
	| InsertAndModify<TTree>;

/**
 * Represents a list of changes to some range of nodes. The index of each mark within the range of nodes, before
 * applying any of the changes, is not represented explicitly.
 * It corresponds to the sum of `inputLength(mark)` for all previous marks.
 * @alpha
 */
export type MarkList<TTree = ProtoNode> = readonly Mark<TTree>[];

/**
 * Represents a range of contiguous nodes that is unaffected by changes.
 * The value represents the length of the range.
 * @alpha
 */
export type Skip = number;

/**
 * Describes modifications made to a subtree.
 * @alpha
 */
export interface Modify<TTree = ProtoNode> {
	readonly type: typeof MarkType.Modify;
	readonly setValue?: Value;
	readonly fields?: FieldMarks<TTree>;
}

/**
 * Describes the deletion of a contiguous range of node.
 * @alpha
 */
export interface Delete {
	readonly type: typeof MarkType.Delete;
	readonly count: number;
}

/**
 * Describes the deletion of a single node.
 * Includes descriptions of the modifications the node.
 * @alpha
 */
export interface ModifyAndDelete<TTree = ProtoNode> {
	readonly type: typeof MarkType.ModifyAndDelete;
	readonly fields: FieldMarks<TTree>;
}

/**
 * Describes the moving out of a contiguous range of node.
 * @alpha
 */
export interface MoveOut {
	readonly type: typeof MarkType.MoveOut;
	readonly count: number;
	/**
	 * The delta should carry exactly one `MoveIn` mark with the same move ID.
	 */
	readonly moveId: MoveId;
}

/**
 * Describes the moving out of a single node.
 * Includes descriptions of the modifications made to the node.
 * @alpha
 */
export interface ModifyAndMoveOut<TTree = ProtoNode> {
	readonly type: typeof MarkType.ModifyAndMoveOut;
	/**
	 * The delta should carry exactly one `MoveIn` mark with the same move ID.
	 */
	readonly moveId: MoveId;
	readonly setValue?: Value;
	readonly fields?: FieldMarks<TTree>;
}

/**
 * Describes the moving in of a contiguous range of node.
 * @alpha
 */
export interface MoveIn {
	readonly type: typeof MarkType.MoveIn;
	readonly count: number;
	/**
	 * The delta should carry exactly one `MoveOut` mark with the same move ID.
	 */
	readonly moveId: MoveId;
}

/**
 * Describes the insertion of a contiguous range of node.
 * @alpha
 */
export interface Insert<TTree = ProtoNode> {
	readonly type: typeof MarkType.Insert;
	// TODO: use a single cursor with multiple nodes instead of array of cursors.
	readonly content: readonly TTree[];
}

/**
 * Describes the insertion of a single node.
 * Includes descriptions of the modifications made to the nodes.
 * @alpha
 */
export interface InsertAndModify<TTree = ProtoNode> {
	readonly type: typeof MarkType.InsertAndModify;
	readonly content: TTree;
	readonly setValue?: Value;
	readonly fields?: FieldMarks<TTree>;
}

/**
 * Uniquely identifies a MoveOut/MoveIn pair within a delta.
 * @alpha
 */
export interface MoveId extends Opaque<Brand<number, "delta.MoveId">> {}

/**
 * @alpha
 */
export type FieldMap<T> = ReadonlyMap<FieldKey, T>;

/**
 * @alpha
 */
export type FieldMarks<TTree = ProtoNode> = FieldMap<MarkList<TTree>>;

/**
 * @alpha
 */
export const MarkType = {
	Modify: 0,
	Insert: 1,
	InsertAndModify: 2,
	MoveIn: 3,
	Delete: 4,
	ModifyAndDelete: 5,
	MoveOut: 6,
	ModifyAndMoveOut: 7,
} as const;
