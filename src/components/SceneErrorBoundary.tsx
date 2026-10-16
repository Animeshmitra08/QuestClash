import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface SceneErrorBoundaryProps {
  children: ReactNode;
  /** Called when the user taps "Try again", before the children are re-mounted. */
  onRetry?: () => void;
}

interface SceneErrorBoundaryState {
  error: Error | null;
  attempt: number;
}

/**
 * Catches render errors from the 3D scene (for example a GL context failure or a
 * broken model) and shows a readable message instead of a blank screen.
 * React only supports error boundaries as class components.
 */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<SceneErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("3D scene crashed:", error, info.componentStack);
  }

  private handleRetry = () => {
    this.props.onRetry?.();
    // Changing the key forces the scene to mount again from scratch.
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
  };

  render() {
    const { error, attempt } = this.state;

    if (error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>The temple failed to load</Text>
          <Text style={styles.message}>{error.message}</Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return <Fragment key={attempt}>{this.props.children}</Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#1b1712",
  },
  title: {
    color: "#f2e6d0",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  message: {
    color: "#c9b99c",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#f2c230",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#1b1712",
    fontSize: 16,
    fontWeight: "700",
  },
});
