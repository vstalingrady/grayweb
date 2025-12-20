import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { User, UserUpdate } from "@/lib/api";

type MapPayload = {
  maps_enabled: boolean;
  maps_widget: boolean;
  maps_latitude?: number;
  maps_longitude?: number;
};

type UseMapsSettingsResult = {
  mapsEnabled: boolean;
  setMapsEnabled: Dispatch<SetStateAction<boolean>>;
  mapsWidgetEnabled: boolean;
  setMapsWidgetEnabled: Dispatch<SetStateAction<boolean>>;
  mapsLatitude: string;
  setMapsLatitude: Dispatch<SetStateAction<string>>;
  mapsLongitude: string;
  setMapsLongitude: Dispatch<SetStateAction<string>>;
  mapPayload: MapPayload;
  toggleMapsEnabled: () => Promise<void>;
};

export const useMapsSettings = (
  user: User | null,
  updateUser?: (userData: UserUpdate) => Promise<void>
): UseMapsSettingsResult => {
  const userScopeKey = useMemo(() => String(user?.id ?? "anon"), [user?.id]);
  const [mapsEnabledOverride, setMapsEnabledOverride] = useState<{
    userScopeKey: string;
    value: boolean | null;
  }>({ userScopeKey, value: null });

  const mapsEnabled = useMemo(() => {
    if (
      mapsEnabledOverride.userScopeKey === userScopeKey &&
      mapsEnabledOverride.value !== null
    ) {
      return mapsEnabledOverride.value;
    }
    return Boolean(user?.maps_enabled);
  }, [mapsEnabledOverride, user?.maps_enabled, userScopeKey]);

  const setMapsEnabled: Dispatch<SetStateAction<boolean>> = useCallback(
    (updater) => {
      const baseValue = mapsEnabled;
      const nextValue =
        typeof updater === "function"
          ? (updater as (value: boolean) => boolean)(baseValue)
          : updater;

      setMapsEnabledOverride({ userScopeKey, value: nextValue });

      if (!user || typeof updateUser !== "function") {
        return;
      }

      void updateUser({ maps_enabled: nextValue })
        .then(() => {
          setMapsEnabledOverride((prev) =>
            prev.userScopeKey === userScopeKey && prev.value === nextValue
              ? { userScopeKey, value: null }
              : prev
          );
        })
        .catch((error) => {
          console.error("Failed to update maps preference:", error);
          setMapsEnabledOverride((prev) =>
            prev.userScopeKey === userScopeKey && prev.value === nextValue
              ? { userScopeKey, value: baseValue }
              : prev
          );
        });
    },
    [mapsEnabled, updateUser, user, userScopeKey]
  );

  const [mapsWidgetEnabled, setMapsWidgetEnabled] = useState(false);
  const [mapsLatitude, setMapsLatitude] = useState("");
  const [mapsLongitude, setMapsLongitude] = useState("");

  const mapPayload = useMemo(() => {
    const normalizedLatitude = mapsLatitude.trim();
    const normalizedLongitude = mapsLongitude.trim();
    const parsedLatitude = normalizedLatitude ? Number(normalizedLatitude) : undefined;
    const parsedLongitude = normalizedLongitude ? Number(normalizedLongitude) : undefined;
    const payload: MapPayload = {
      maps_enabled: mapsEnabled,
      maps_widget: mapsWidgetEnabled,
    };
    if (normalizedLatitude && !Number.isNaN(parsedLatitude ?? Number.NaN)) {
      payload.maps_latitude = parsedLatitude;
    }
    if (normalizedLongitude && !Number.isNaN(parsedLongitude ?? Number.NaN)) {
      payload.maps_longitude = parsedLongitude;
    }
    return payload;
  }, [mapsEnabled, mapsLatitude, mapsLongitude, mapsWidgetEnabled]);

  const hasLocationCoordinates = Boolean(
    mapPayload.maps_latitude != null && mapPayload.maps_longitude != null
  );

  const getGeolocation = useCallback(
    (): Promise<{ latitude: number; longitude: number } | null> =>
      new Promise((resolve) => {
        if (typeof window === "undefined" || !window.navigator?.geolocation) {
          resolve(null);
          return;
        }
        window.navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          () => resolve(null)
        );
      }),
    []
  );

  // Helper to manually request location (e.g. from the Tools menu)
  const requestLocationCoordinates = useCallback(async () => {
    const coords = await getGeolocation();
    if (coords) {
      setMapsLatitude(coords.latitude.toString());
      setMapsLongitude(coords.longitude.toString());
      setMapsWidgetEnabled(true);
      return true;
    }
    return false;
  }, [getGeolocation]);

  const toggleMapsEnabled = useCallback(async () => {
    const nextState = !mapsEnabled;
    setMapsEnabled(nextState);

    // If enabling, also try to get coordinates if not already present
    if (nextState && !hasLocationCoordinates) {
      await requestLocationCoordinates();
    }
  }, [hasLocationCoordinates, mapsEnabled, requestLocationCoordinates, setMapsEnabled]);

  return {
    mapsEnabled,
    setMapsEnabled,
    mapsWidgetEnabled,
    setMapsWidgetEnabled,
    mapsLatitude,
    setMapsLatitude,
    mapsLongitude,
    setMapsLongitude,
    mapPayload,
    toggleMapsEnabled,
  };
};
