/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

export {
	Anchor,
	AnchorLocator,
	AnchorSet,
	AnchorKeyBrand,
	AnchorSlot,
	BrandedKey,
	BrandedKeyContent,
	BrandedMapSubset,
	AnchorNode,
	anchorSlot,
	AnchorEvents,
	AnchorSetRootEvents,
} from "./anchorSet";
export {
	ITreeCursor,
	CursorLocationType,
	castCursorToSynchronous,
	mapCursorField,
	mapCursorFields,
	forEachNode,
	forEachField,
	ITreeCursorSynchronous,
	PathRootPrefix,
	inCursorField,
	inCursorNode,
} from "./cursor";
export {
	GlobalFieldKeySymbol,
	keyFromSymbol,
	symbolFromKey,
	symbolIsFieldKey,
} from "./globalFieldKeySymbol";
export { getMapTreeField, MapTree } from "./mapTree";
export {
	clonePath,
	getDepth,
	UpPath,
	FieldUpPath,
	compareUpPaths,
	compareFieldUpPaths,
	UpPathDefault,
} from "./pathTree";
export {
	FieldMapObject,
	FieldScope,
	GenericFieldsNode,
	genericTreeDeleteIfEmpty,
	genericTreeKeys,
	GenericTreeNode,
	getGenericTreeField,
	isGlobalFieldKey,
	JsonableTree,
	scopeFromKey,
	setGenericTreeField,
} from "./treeTextFormat";
export {
	EmptyKey,
	FieldKey,
	TreeType,
	ChildLocation,
	DetachedField,
	ChildCollection,
	RootField,
	Value,
	TreeValue,
	detachedFieldAsKey,
	keyAsDetachedField,
	rootFieldKey,
	NodeData,
	rootFieldKeySymbol,
	rootField,
	isLocalKey,
} from "./types";
export { DeltaVisitor, visitDelta } from "./visitDelta";

// Split this up into separate import and export for compatibility with API-Extractor.
import * as Delta from "./delta";
export { Delta };

export { SparseNode, getDescendant } from "./sparseTree";

export { isSkipMark, emptyDelta } from "./deltaUtil";
