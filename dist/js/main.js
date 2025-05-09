import BootScene from './scenes/BootScene.js';
import StartScene from './scenes/StartScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import GameScene from './scenes/GameScene.js';
import StatisticsScene from './scenes/StatisticsScene.js'; // Import the new Statistics scene

// Phaser Game Configuration
const config = {
    type: Phaser.AUTO, // Automatically choose WebGL or Canvas
    width: 800,        // Width of the game canvas
    height: 600,       // Height of the game canvas
    parent: 'body',    // Attach canvas to the body element
    physics: {
        default: 'arcade', // Use the Arcade Physics engine
        arcade: {
            // debug: true, // Set true to see physics bodies and velocity vectors
            gravity: { y: 0 } // No downward gravity needed
        }
    },
    // List of scenes to include in the game
    // The first scene in the array is the one that starts automatically
    scene: [BootScene, StartScene, LevelSelectScene, GameScene, StatisticsScene] // Add StatisticsScene
};

// Create a new Phaser Game instance
const game = new Phaser.Game(config);
