
import { EventEmitter } from "events";
import { FirestorePermissionError } from "./errors";

type ErrorEvents = {
  "permission-error": (error: FirestorePermissionError) => void;
};

// We need to declare the `emit` method with the specific event types
// to get proper type-checking and inference.
interface TypedEventEmitter extends EventEmitter {
  emit<T extends keyof ErrorEvents>(event: T, ...args: Parameters<ErrorEvents[T]>): boolean;
  on<T extends keyof ErrorEvents>(event: T, listener: ErrorEvents[T]): this;
}

// Although EventEmitter is not strictly typed, we can cast it to our typed interface.
export const errorEmitter = new EventEmitter() as TypedEventEmitter;

    
