import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import type { InventoryItem } from "@/types/game";

const SLOT_COUNT = 3;

interface InventoryProps {
  items: readonly InventoryItem[];
  style?: StyleProp<ViewStyle>;
}

/** A row of item slots. Empty slots stay visible so the player knows items exist. */
export function Inventory({ items, style }: InventoryProps) {
  return (
    <View style={[styles.container, style]} pointerEvents="none" accessibilityLabel="Inventory">
      {Array.from({ length: SLOT_COUNT }, (_, index) => {
        const item = items[index];
        return (
          <View key={index} style={[styles.slot, item && styles.slotFilled]}>
            {item && (
              <>
                <Text style={styles.icon}>🗝️</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 6,
  },
  slot: {
    width: 64,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(242, 230, 208, 0.3)",
    backgroundColor: "rgba(27, 23, 18, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotFilled: {
    borderColor: "#f2c230",
  },
  icon: {
    fontSize: 22,
  },
  name: {
    color: "#f2e6d0",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    paddingHorizontal: 2,
  },
});
