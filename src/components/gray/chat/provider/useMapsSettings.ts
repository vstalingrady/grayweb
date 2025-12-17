/* eslint-disable react-hooks/set-state-in-effect */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { User } from "@/lib/api";

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

export const useMapsSettings = (user: User | null): UseMapsSettingsResult => {
  const [mapsEnabled, setMapsEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      setMapsEnabled(Boolean(user.maps_enabled));
    }
  }, [user]);

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
  }, [hasLocationCoordinates, mapsEnabled, requestLocationCoordinates]);

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
