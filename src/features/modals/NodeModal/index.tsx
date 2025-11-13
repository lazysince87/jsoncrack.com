import React from "react";
import type { ModalProps } from "@mantine/core";
import {
  Modal,
  Stack,
  Text,
  ScrollArea,
  Flex,
  CloseButton,
  Textarea,
  Button,
  Group,
} from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeType } from "jsonc-parser";
import toast from "react-hot-toast";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const { selectedNode } = useGraph(state => state);
  const { getJson } = useJson(state => state);
  const { setContents } = useFile(state => state);

  const [isEditing, setIsEditing] = React.useState(false);
  const [editedContent, setEditedContent] = React.useState("");

  const nodePath = selectedNode?.path;
  const fullJson = getJson();
  const normalizedData = normalizeNodeData(selectedNode?.text || []);

  const handleEditToggle = () => {
    if (!isEditing) {
      setEditedContent(normalizedData);
    }
    setIsEditing(!isEditing);
  };

  const handleSave = () => {
    try {
      const parsedContent = JSON.parse(editedContent);
      const updatedJson = updateJsonAtPath(
        JSON.parse(fullJson),
        jsonPathToString(nodePath),
        parsedContent
      );

      // Update the JSON file
      setContents({ contents: JSON.stringify(updatedJson, null, 2) });

      // Update the selectedNode in the useGraph store
      useGraph.setState(state => {
        if (!state.selectedNode) return state; // Return current state if selectedNode is null
        return {
          ...state,
          selectedNode: {
            ...state.selectedNode,
            id: state.selectedNode.id || "", // Ensure id is always a string
            text: Object.entries(parsedContent).map(([key, value]) => ({
              key,
              value: value as string | number | null, // Ensure value is of compatible type
              type: "default" as NodeType, // Ensure type is cast to NodeType
            })),
          },
        };
      });

      toast.success("JSON updated successfully!");
      setIsEditing(false); // Return to the "Edit" button state
    } catch (error) {
      toast.error("Invalid JSON. Please check your input.");
    }
  };

  const handleCancel = () => {
    setEditedContent(normalizedData);
    setIsEditing(false);
  };

  return (
    <Modal opened={opened} onClose={onClose} size="auto" centered withCloseButton={false}>
      <Stack>
        <Flex justify="space-between" align="center">
          <Text fz="lg" fw={500}>
            Content
          </Text>
          <Group gap="sm">
            {isEditing ? (
              <>
                <Button size="xs" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="xs" onClick={handleSave}>
                  Save
                </Button>
              </>
            ) : (
              <Button size="xs" onClick={handleEditToggle}>
                Edit
              </Button>
            )}
            <CloseButton onClick={onClose} />
          </Group>
        </Flex>
        <ScrollArea.Autosize mah={250} maw={600}>
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={e => setEditedContent(e.target.value)}
              styles={{ input: { fontFamily: "monospace", width: "100%" } }}
              minRows={10}
              autosize
              miw={350}
              maw={600}
            />
          ) : (
            <CodeHighlight code={normalizedData} language="json" withCopyButton />
          )}
        </ScrollArea.Autosize>
        <Stack gap="sm">
          <Text fz="sm" fw={500}>
            JSON Path
          </Text>
          <Flex align="center" gap="sm">
            <CodeHighlight code={jsonPathToString(nodePath)} language="json" withCopyButton />
          </Flex>
        </Stack>
      </Stack>
    </Modal>
  );
};

// Helper functions
const normalizeNodeData = (nodeRows: NodeData["text"]): string => {
  if (!nodeRows || nodeRows.length === 0) return "{}";

  if (nodeRows.length === 1 && !nodeRows[0].key) {
    return JSON.stringify(nodeRows[0].value, null, 2);
  }

  const compactJson = nodeRows.reduce(
    (acc, row) => {
      if (row.key && typeof row.value !== "object") {
        acc[row.key] = row.value;
      }
      return acc;
    },
    {} as Record<string, any>
  );

  return JSON.stringify(compactJson, null, 2);
};

const jsonPathToString = (path?: NodeData["path"]): string => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

const updateJsonAtPath = (jsonObj: any, path: string, newValue: any): any => {
  if (!path) return jsonObj;

  const pathSegments = path
    .replace(/^\$\[|\]$/g, "") // Remove leading `$[` and trailing `]`
    .split("][")
    .map(seg => (isNaN(Number(seg)) ? seg.replace(/"/g, "") : Number(seg)));

  const clonedJson = JSON.parse(JSON.stringify(jsonObj));
  let current = clonedJson;

  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    current = current[segment] = current[segment] || {};
  }

  current[pathSegments[pathSegments.length - 1]] = newValue;
  return clonedJson;
};
