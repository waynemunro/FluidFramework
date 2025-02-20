/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { fail, strict as assert } from "assert";
import {
	RevisionTag,
	Delta,
	FieldKey,
	ITreeCursorSynchronous,
	TreeSchemaIdentifier,
	mintRevisionTag,
} from "../../../core";
import {
	ChangesetLocalId,
	FieldChange,
	FieldKinds,
	NodeChangeset,
	SequenceField as SF,
	singleTextCursor,
} from "../../../feature-libraries";
import { brand, brandOpaque, makeArray } from "../../../util";
import { TestChange } from "../../testChange";
import { assertMarkListEqual, deepFreeze } from "../../utils";
import { ChangeMaker as Change, TestChangeset } from "./testEdits";
import { composeAnonChanges } from "./utils";

const type: TreeSchemaIdentifier = brand("Node");
const nodeX = { type, value: 0 };
const content = [nodeX];
const contentCursor: ITreeCursorSynchronous[] = [singleTextCursor(nodeX)];
const moveId = brand<ChangesetLocalId>(4242);
const tag: RevisionTag = mintRevisionTag();
const tag2: RevisionTag = mintRevisionTag();
const tag3: RevisionTag = mintRevisionTag();
const deltaMoveId = brandOpaque<Delta.MoveId>(moveId);
const fooField = brand<FieldKey>("foo");

const DUMMY_REVIVED_NODE_TYPE: TreeSchemaIdentifier = brand("DummyRevivedNode");

function fakeRepairData(_revision: RevisionTag, _index: number, count: number): Delta.ProtoNode[] {
	return makeArray(count, () => singleTextCursor({ type: DUMMY_REVIVED_NODE_TYPE }));
}

function toDelta(change: TestChangeset): Delta.MarkList {
	deepFreeze(change);
	return SF.sequenceFieldToDelta(change, TestChange.toDelta);
}

function toDeltaShallow(change: TestChangeset): Delta.MarkList {
	deepFreeze(change);
	return SF.sequenceFieldToDelta(change, () => fail("Unexpected call to child ToDelta"));
}

const childChange1 = TestChange.mint([0], 1);
const childChange1Delta = TestChange.toDelta(childChange1);

describe("SequenceField - toDelta", () => {
	it("empty mark list", () => {
		const actual = toDeltaShallow([]);
		assert.deepEqual(actual, []);
	});

	it("child change", () => {
		const actual = toDelta(Change.modify(0, childChange1));
		const expected: Delta.MarkList = [childChange1Delta];
		assert.deepEqual(actual, expected);
	});

	it("empty child change", () => {
		const actual = toDelta(Change.modify(0, TestChange.emptyChange));
		const expected: Delta.MarkList = [];
		assert.deepEqual(actual, expected);
	});

	it("insert", () => {
		const changeset = Change.insert(0, 1);
		const mark: Delta.Insert = {
			type: Delta.MarkType.Insert,
			content: contentCursor,
		};
		const expected: Delta.MarkList = [mark];
		const actual = toDelta(changeset);
		assert.deepStrictEqual(actual, expected);
	});

	it("revive => insert", () => {
		function reviver(revision: RevisionTag, index: number, count: number): Delta.ProtoNode[] {
			assert.equal(revision, tag);
			assert.equal(index, 0);
			assert.equal(count, 1);
			return contentCursor;
		}
		const changeset = Change.revive(0, 1, tag, 0, reviver);
		const actual = toDelta(changeset);
		const expected: Delta.MarkList = [
			{
				type: Delta.MarkType.Insert,
				content: contentCursor,
			},
		];
		assertMarkListEqual(actual, expected);
	});

	it("conflicted revive => skip", () => {
		const changeset: TestChangeset = composeAnonChanges([
			Change.revive(0, 1, tag, 0, undefined, tag2),
			Change.modify(1, childChange1),
		]);
		const actual = toDelta(changeset);
		const expected: Delta.MarkList = [1, childChange1Delta];
		assertMarkListEqual(actual, expected);
	});

	it("blocked revive => nil", () => {
		const changeset: TestChangeset = composeAnonChanges([
			Change.revive(0, 1, tag, 0, undefined, tag2, undefined, tag3),
			Change.modify(1, childChange1),
		]);
		const actual = toDelta(changeset);
		const expected: Delta.MarkList = [1, childChange1Delta];
		assertMarkListEqual(actual, expected);
	});

	it("revive and modify => insert", () => {
		const nestedChange: FieldChange = {
			fieldKind: FieldKinds.sequence.identifier,
			change: brand("Dummy Child Change"),
		};
		const nodeChange = {
			fieldChanges: new Map([[fooField, nestedChange]]),
		};
		const changeset: SF.Changeset = [
			{
				type: "Revive",
				content: contentCursor,
				count: 1,
				detachedBy: tag,
				detachIndex: 0,
				changes: nodeChange,
			},
		];
		const fieldChanges = new Map([[fooField, [{ type: Delta.MarkType.Insert, content: [] }]]]);
		const deltaFromChild = (child: NodeChangeset): Delta.Modify => {
			assert.deepEqual(child, nodeChange);
			return { type: Delta.MarkType.Modify, fields: fieldChanges };
		};
		const actual = SF.sequenceFieldToDelta(changeset, deltaFromChild);
		const expected: Delta.MarkList = [
			{
				type: Delta.MarkType.Insert,
				content: contentCursor,
			},
		];
		assertMarkListEqual(actual, expected);
	});

	it("delete", () => {
		const changeset = Change.delete(0, 10);
		const mark: Delta.Delete = {
			type: Delta.MarkType.Delete,
			count: 10,
		};
		const expected: Delta.MarkList = [mark];
		const actual = toDelta(changeset);
		assert.deepStrictEqual(actual, expected);
	});

	it("move", () => {
		const changeset: TestChangeset = [
			42,
			{
				type: "MoveOut",
				id: moveId,
				count: 10,
			},
			8,
			{
				type: "MoveIn",
				id: moveId,
				count: 10,
			},
		];
		const moveOut: Delta.MoveOut = {
			type: Delta.MarkType.MoveOut,
			moveId: deltaMoveId,
			count: 10,
		};
		const moveIn: Delta.MoveIn = {
			type: Delta.MarkType.MoveIn,
			moveId: deltaMoveId,
			count: 10,
		};
		const expected: Delta.MarkList = [42, moveOut, 8, moveIn];
		const actual = toDelta(changeset);
		assert.deepStrictEqual(actual, expected);
	});

	it("multiple changes", () => {
		const changeset = composeAnonChanges([
			Change.delete(0, 10),
			Change.insert(3, 1),
			Change.modify(5, childChange1),
		]);
		const del: Delta.Delete = {
			type: Delta.MarkType.Delete,
			count: 10,
		};
		const ins: Delta.Insert = {
			type: Delta.MarkType.Insert,
			content: contentCursor,
		};
		const set: Delta.Modify = {
			type: Delta.MarkType.Modify,
			setValue: "1",
		};
		const expected: Delta.MarkList = [del, 3, ins, 1, set];
		const actual = toDelta(changeset);
		assert.deepStrictEqual(actual, expected);
	});

	it("insert and modify => InsertAndModify", () => {
		const changeset = composeAnonChanges([Change.insert(0, 1), Change.modify(0, childChange1)]);
		const mark: Delta.InsertAndModify = {
			type: Delta.MarkType.InsertAndModify,
			content: singleTextCursor({
				type,
				value: 0,
			}),
			setValue: "1",
		};
		const expected: Delta.MarkList = [mark];
		const actual = toDelta(changeset);
		assertMarkListEqual(actual, expected);
	});

	it("modify and delete => delete", () => {
		const changeset = composeAnonChanges([Change.modify(0, childChange1), Change.delete(0, 1)]);
		const mark: Delta.Delete = {
			type: Delta.MarkType.Delete,
			count: 1,
		};
		const expected: Delta.MarkList = [mark];
		const actual = toDelta(changeset);
		assertMarkListEqual(actual, expected);
	});

	// This test requires more support for MoveIn
	it.skip("Insert and modify w/ move-in => Insert and modify", () => {
		const nestedChange: FieldChange = {
			fieldKind: FieldKinds.sequence.identifier,
			change: brand({
				type: "MoveIn",
				id: moveId,
				count: 42,
			}),
		};
		const nodeChange = {
			fieldChanges: new Map([[fooField, nestedChange]]),
		};
		const changeset: SF.Changeset = [
			{
				type: "Insert",
				content,
				changes: nodeChange,
			},
		];
		const nestedMoveDelta = new Map([
			[fooField, [{ type: Delta.MarkType.MoveIn, moveId: deltaMoveId, count: 42 }]],
		]);
		const mark: Delta.InsertAndModify = {
			type: Delta.MarkType.InsertAndModify,
			content: contentCursor[0],
			fields: nestedMoveDelta,
		};
		const expected: Delta.MarkList = [mark];
		const deltaFromChild = (child: NodeChangeset): Delta.Modify => {
			assert.deepEqual(child, nodeChange);
			return { type: Delta.MarkType.Modify, fields: nestedMoveDelta };
		};
		const actual = SF.sequenceFieldToDelta(changeset, deltaFromChild);
		assertMarkListEqual(actual, expected);
	});
});
