extends Node2D

const PLAYER_SCENE := preload("res://scenes/actors/player.tscn")

var player: CharacterBody2D

func _ready() -> void:
    player = PLAYER_SCENE.instantiate()
    player.position = Vector2(118, 237)
    $Stage01HQ.add_child(player)
    $Stage01HQ.set_player(player)
    $CanvasLayer/HUD.set_player(player)
    $CanvasLayer/HUD.set_stage($Stage01HQ)

func _process(_delta: float) -> void:
    if player == null:
        return
    var camera: Camera2D = $Stage01HQ/Camera2D
    camera.global_position.x = clampf(player.global_position.x, 240.0, 1960.0)
    camera.global_position.y = 135.0
