import Enemy from './Enemy.js';

export default class Ghost extends Enemy {
    constructor(scene, x, y) {
        const config = {
            hitPoints: 1,
            moveSpeed: 40, // Slower speed
            isLoner: false, // Can spawn in groups
            animationKey: 'ghost_idle',
            scale: 2.0
        };
         // Use frame 3 from 'enemies' spritesheet as default frame
        super(scene, x, y, 'enemies', 3, config);
    }

    // Override methods if Ghost has unique behavior
}
