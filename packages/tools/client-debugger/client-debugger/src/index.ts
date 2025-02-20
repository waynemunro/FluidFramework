/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Contains a simple API for initializing debug sessions for recording and propogating information
 * about a given {@link @fluidframework/container-definitions#IContainer | Fluid Container} and its
 * {@link @fluidframework/container-definitions#Audience}.
 *
 * Debugger instances are created per `Container` instance and are bound to the `globalThis` context
 * to be accessible to related tools.
 *
 * - See the package README for more details on related tools that are enabled via these debugger instances.
 *
 * @remarks
 *
 * The general usage pattern for this library is to first initialize a debugger for a given Fluid Client
 * ({@link @fluidframework/container-definitions#IContainer} and {@link @fluidframework/container-definitions#IAudience})
 * by calling {@link initializeFluidClientDebugger} during application setup / any time after your container has been
 * attached.
 *
 * Then, during application teardown, call {@link closeFluidClientDebugger} to clean up the debugger and its resources.
 *
 * @example Initialization
 *
 * ```typescript
 * initializeFluidClientDebugger({
 *  containerId,
 *  container,
 *  containerData: {
 *      rootMap: sharedMap
 *  },
 * });
 * ```
 *
 * @example Disposal
 *
 * ```typescript
 * closeFluidClientDebugger(containerId);
 * ```
 *
 * @packageDocumentation
 */

export { MemberChangeKind } from "./AudienceMetadata";
export { ContainerStateChangeKind } from "./Container";
export { ContainerMetadata, ContainerStateMetadata } from "./ContainerMetadata";

export { IFluidClientDebugger, IFluidClientDebuggerEvents } from "./IFluidClientDebugger";
export {
	AudienceChangeLogEntry,
	ConnectionStateChangeLogEntry,
	LogEntry,
	StateChangeLogEntry,
} from "./Logs";
export {
	debuggerMessageSource,
	HasContainerId,
	ConnectContainerMessage,
	ConnectContainerMessageData,
	DisconnectContainerMessage,
	DisconnectContainerMessageData,
	CloseContainerMessage,
	CloseContainerMessageData,
	ContainerStateChangeMessage,
	ContainerStateChangeMessageData,
	IDebuggerMessage,
	GetContainerListMessage,
	GetContainerStateMessage,
	GetContainerStateMessageData,
	RegistryChangeMessage,
	RegistryChangeMessageData,
	TelemetryEventMessage,
	TelemetryEventMessageData,
	handleIncomingMessage,
	handleIncomingWindowMessage,
	InboundHandlers,
	isDebuggerMessage,
	MessageLoggingOptions,
	postMessageToWindow,
} from "./messaging";
export {
	DebuggerRegistry,
	DebuggerRegistryEvents,
	clearDebuggerRegistry,
	closeFluidClientDebugger,
	FluidClientDebuggerProps,
	getDebuggerRegistry,
	getFluidClientDebugger,
	getFluidClientDebuggers,
	initializeFluidClientDebugger,
} from "./Registry";
export { FluidDebuggerLogger } from "./FluidDebuggerLogger";
