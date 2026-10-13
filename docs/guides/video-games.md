# Video games

[English](video-games.md) | [Français](video-games.fr.md)

**Download Studio + Controller:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-desktop-applications).

There are two ways to use MIG with games: send keyboard events to an existing
game using the Controller, or integrate recognition into a game you develop.

## Control an existing game

> [!CAUTION]
> Check the publisher's rules before enabling output. MIG uses operating-system
> keyboard events without modifying the game or accessing its process memory.
> An anti-cheat may still flag unfamiliar software or simulated input. This is
> not a guarantee of acceptance or protection from account penalties. Avoid
> competitive/protected sessions when permission is unclear; do not try to bypass
> an anti-cheat restriction.

1. Choose an offline or explicitly permitted session. Check the game's actual
   keyboard bindings; use one harmless action first, such as a menu direction.
2. Create a wrist movement in [Studio Web](studio-web.md) or
   [desktop Studio](configurator.md). Draw 🟩 **Required** regions along the route
   and end with 🟨 **Trigger**. A 🟥 **Forbidden** region cancels an unwanted
   route; a 🟪 **Interaction** adds a hand-sign condition.
3. Associate the game's key in desktop Studio's movement settings, or add a
   `keyboard` field through Studio Web's JSON editor. The
   [presentation guide](presentations.md) shows a complete field-editing example;
   replace its key with the game's binding using the
   [keyboard reference](../reference/configuration.md).
4. Export JSON, stop the editor camera and import it in the
   [Controller](controller.md). Calibrate and verify recognition with output off.
5. Enable output and focus the game. Test one action before adding others.
   If the game rejects simulated input, stop using that binding rather than
   changing security settings to force it.

Use **Single press** for discrete actions, **Hold** for a key that should remain
pressed while the terminal conditions are met, or **Repeat** for repeated presses.
These modes do not behave identically; test releases as well as activations.
Stop tracking or disable output to release held keys. Prefer controls whose
accidental activation has little consequence while learning your routes.

## Integrate into your own game

Handle MIG's logical actions directly in your game rather than sending system
keys. Choose [SDL2 / SFML](../integrations/overview.md),
[Godot](../../integrations/godot/README.md),
[Unity](../../integrations/unity/README.md),
[Unreal](../../integrations/unreal/README.md), or
[JavaScript frameworks](../integrations/javascript.md).

Engine integrations require a landmark provider. Import the same JSON profile,
provide observations and map recognized action names to game behavior. Use the
[example catalogue](../../examples/README.md) for runnable starting points and
check the [support matrix](../reference/support.md) for Preview limitations.
