import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export const useHasHydrated = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

