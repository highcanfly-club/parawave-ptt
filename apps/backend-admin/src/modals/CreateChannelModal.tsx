import { useTranslation } from "react-i18next";
import { Button } from "@heroui/button";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { Input } from "@heroui/input";
import {
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
} from "@heroui/dropdown";

import { ChannelType, CreateChannelRequest } from "@/types/ptt";

interface CreateChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    formData: CreateChannelRequest;
    setFormData: (data: CreateChannelRequest) => void;
    onSubmit: () => void;
    submitting: boolean;
}

export default function CreateChannelModal({
    isOpen,
    onClose,
    formData,
    setFormData,
    onSubmit,
    submitting,
}: CreateChannelModalProps) {
    const { t } = useTranslation();

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl">
            <ModalContent>
                <ModalHeader>
                    <h3>{t("create_channel")}</h3>
                </ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-4">
                        <Input
                            label={t("channel_name")}
                            placeholder="Enter channel name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            isRequired
                        />
                        <div className="flex flex-col gap-2">
                            <label className="text-small text-default-500">{t("channel_type")}</label>
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button variant="bordered" className="capitalize">
                                        {formData.type.replace('_', ' ')}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label="Channel type selection"
                                    selectionMode="single"
                                    selectedKeys={[formData.type]}
                                    onSelectionChange={(keys: any) => {
                                        const selected = Array.from(keys)[0] as ChannelType;
                                        setFormData({ ...formData, type: selected });
                                    }}
                                >
                                    <DropdownItem key="general">General</DropdownItem>
                                    <DropdownItem key="site_local">Site Local</DropdownItem>
                                    <DropdownItem key="cross_country">Cross Country</DropdownItem>
                                    <DropdownItem key="instructors">Instructors</DropdownItem>
                                    <DropdownItem key="emergency">Emergency</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                        <div className="flex gap-4">
                            <Input
                                label={t("max_participants")}
                                type="number"
                                placeholder="10"
                                value={formData.max_participants?.toString() || ''}
                                onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 10 })}
                            />
                            <Input
                                label={t("vhf_frequency")}
                                placeholder="123.456 MHz"
                                value={formData.vhf_frequency}
                                onChange={(e) => setFormData({ ...formData, vhf_frequency: e.target.value })}
                            />
                        </div>
                        <Input
                            label={t("description")}
                            placeholder="Channel description (optional)"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button
                        color="danger"
                        variant="light"
                        onPress={onClose}
                        isDisabled={submitting}
                    >
                        {t("cancel")}
                    </Button>
                    <Button
                        color="primary"
                        onPress={onSubmit}
                        isLoading={submitting}
                    >
                        {t("create_channel")}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
