import { Feather } from "@expo/vector-icons";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  ViewAnnotation,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MAP_STYLE } from "./offlineMaps";
import { radius, useTheme } from "./theme";
import { routeBounds, type Route } from "./track";
import { DANGER_TOKEN, type Checkpoint } from "./ui";

const line = (route: Route): GeoJSON.Feature => ({
  type: "Feature",
  properties: {},
  geometry: {
    type: "LineString",
    coordinates: route.map(([lat, lng]) => [lng, lat]),
  },
});

/**
 * A real map (OpenFreeMap tiles) with the walked route, the plan dashed underneath, and every
 * stop pinned. Tiles come from the network or a downloaded area; with neither, the map is blank
 * but the route still draws.
 */
export function TrailMap({
  route,
  planned = [],
  checkpoints = [],
  height,
  live,
  label,
}: {
  route: Route;
  planned?: Route;
  checkpoints?: readonly Checkpoint[];
  height: number;
  live?: boolean;
  label: string;
}) {
  const { colors, isDark } = useTheme();
  const all = useMemo(() => [...planned, ...route], [planned, route]);
  const bounds = routeBounds(all, 150);
  const camera = useRef<CameraRef>(null);
  const padding = { top: 28, bottom: 28, left: 28, right: 28 };
  const start = route[0] ?? planned[0];
  const end = route[route.length - 1];

  return (
    <View style={[styles.map, { height }]}>
      {/* The map is one labelled image to screen readers; the re-centre button stays reachable beside it */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={StyleSheet.absoluteFill}
      >
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE[isDark ? "dark" : "light"]}
          attribution={false}
          logo={false}
          compass={false}
          touchRotate={false}
          touchPitch={false}
        >
          {bounds && (
            <Camera
              ref={camera}
              bounds={bounds}
              padding={padding}
              duration={live ? 600 : 0}
            />
          )}
          {planned.length > 1 && (
            <GeoJSONSource id="planned" data={line(planned)}>
              <Layer
                id="planned-line"
                type="line"
                style={{
                  lineColor: colors.muted,
                  lineWidth: 3,
                  lineDasharray: [2, 2],
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </GeoJSONSource>
          )}
          {route.length > 1 && (
            <GeoJSONSource id="walked" data={line(route)}>
              <Layer
                id="walked-casing"
                type="line"
                style={{
                  lineColor: colors.surface,
                  lineWidth: 8,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              <Layer
                id="walked-line"
                type="line"
                style={{
                  lineColor: colors.accent,
                  lineWidth: 4.5,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </GeoJSONSource>
          )}
          {start && (
            <ViewAnnotation id="start" lngLat={[start[1], start[0]]}>
              <View
                style={[
                  styles.dot,
                  styles.big,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.accent,
                  },
                ]}
              />
            </ViewAnnotation>
          )}
          {end && route.length > 1 && (
            <ViewAnnotation id="end" lngLat={[end[1], end[0]]}>
              <View
                style={[
                  styles.dot,
                  styles.big,
                  live
                    ? {
                        backgroundColor: colors.accent,
                        borderColor: colors.surface,
                      }
                    : {
                        backgroundColor: colors.text,
                        borderColor: colors.surface,
                      },
                ]}
              />
            </ViewAnnotation>
          )}
          {checkpoints.map((c, i) =>
            c.lat === null || c.lng === null ? null : (
              <ViewAnnotation key={i} id={`stop-${i}`} lngLat={[c.lng, c.lat]}>
                {c.kind === "scenery" ? (
                  <View
                    style={[styles.star, { backgroundColor: colors.surface }]}
                  >
                    <Feather name="star" size={14} color={colors.text} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: colors[DANGER_TOKEN[c.danger]],
                        borderColor: colors.surface,
                      },
                    ]}
                  />
                )}
              </ViewAnnotation>
            ),
          )}
        </Map>
      </View>
      {bounds && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Re-centre map on the route"
          hitSlop={8}
          onPress={() =>
            camera.current?.fitBounds(bounds, { padding, duration: 400 })
          }
          style={({ pressed }) => [
            styles.recenter,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="crosshair" size={16} color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: 16, overflow: "hidden" },
  // 32 pt plus an 8 pt hit slop on every side: small on the map, still a 48 pt target
  recenter: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5 },
  big: { width: 18, height: 18, borderRadius: 9, borderWidth: 4 },
  star: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
