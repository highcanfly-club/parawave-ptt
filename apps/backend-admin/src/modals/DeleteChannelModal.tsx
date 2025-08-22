import { useTranslation } from "react-i18next";
import { Button } from "@heroui/button";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";

import { PTTChannel } from "@/types/ptt";

interface DeleteChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    channelToDelete: PTTChannel | null;
    onConfirm: () => void;
    submitting: boolean;
}

export default function DeleteChannelModal({
    isOpen,
    onClose,
    channelToDelete,
    onConfirm,
    submitting,
}: DeleteChannelModalProps) {
    const { t } = useTranslation();

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalContent>
                <ModalHeader>
                    <h3>{t("delete_channel")}</h3>
                </ModalHeader>
                <ModalBody>
                    <p>
                        {t("are_you_sure_delete_channel")}{" "}
                        <strong>{channelToDelete?.name}</strong>?
                    </p>
                    <p className="text-danger-500">
                        {t("this_action_cannot_be_undone")}
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button
                        color="default"
                        variant="light"
                        onPress={onClose}
                        isDisabled={submitting}
                    >
                        {t("cancel")}
                    </Button>
                    <Button
                        color="danger"
                        onPress={onConfirm}
                        isLoading={submitting}
                    >
                        {t("delete")}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
