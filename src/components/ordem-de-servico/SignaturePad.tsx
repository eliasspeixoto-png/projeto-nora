
"use client";

import React, { useRef } from 'react';
import { Stage, Layer, Line } from 'react-konva';

interface SignaturePadProps {
  onClear?: () => void;
}

const SignaturePad = React.forwardRef<any, SignaturePadProps>((props, ref) => {
  const [lines, setLines] = React.useState<any[]>([]);
  const isDrawing = React.useRef(false);
  const stageRef = useRef<any>(null); // Use a ref for the stage

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) {
      return;
    }
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    // Adiciona os novos pontos à última linha
    lastLine.points = lastLine.points.concat([point.x, point.y]);

    // Substitui a última linha no array
    lines.splice(lines.length - 1, 1, lastLine);
    // Cria um novo array para forçar a re-renderização
    setLines(lines.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };
  
  const clear = () => {
    setLines([]);
    if (props.onClear) {
        props.onClear();
    }
  }
  
  React.useImperativeHandle(ref, () => ({
    clear: clear,
    getSignature: () => {
        if (!stageRef.current || lines.length === 0) {
            return null;
        }
        return stageRef.current.toDataURL();
    }
  }));

  return (
    <div className="border rounded-lg bg-background">
      <Stage
        width={300}
        height={200}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Garante que o desenho pare se o mouse sair da área
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        ref={stageRef}
      >
        <Layer>
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke="hsl(var(--foreground))"
              strokeWidth={3}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                line.tool === 'eraser' ? 'destination-out' : 'source-over'
              }
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
});

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;
