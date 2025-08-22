import { Button } from "@heroui/button";
import { Kbd } from "@heroui/kbd";
import { Link } from "@heroui/link";
import { Input } from "@heroui/input";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@heroui/dropdown";
import {
  Navbar as HeroUINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from "@heroui/navbar";
import { link as linkStyles } from "@heroui/theme";
import { clsx } from "@heroui/shared-utils";
import { Trans, useTranslation } from "react-i18next";

import { I18nIcon, LanguageSwitch } from "./language-switch";

import { LoginLogoutButton, LoginLogoutLink } from "@/authentication";
import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import {
  TwitterIcon,
  GithubIcon,
  DiscordIcon,
  HeartFilledIcon,
  SearchIcon,
} from "@/components/icons";
import { Logo } from "@/components/icons";
import { availableLanguages } from "@/i18n";
import { useAuth, useSecuredApi } from "@/authentication";
import { useEffect, useState } from "react";
import { APIResponse, ChannelsListResponse } from "@/types/ptt";

export const Navbar = () => {
  const { t } = useTranslation();
  const { getJson } = useSecuredApi();
  const { isAuthenticated, user, hasPermission } = useAuth();
  const [channels, setChannels] = useState<ChannelsListResponse | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const adminPermission = await hasPermission(import.meta.env.ADMIN_PERMISSION);
      setIsAdminUser(adminPermission);

      if (isAuthenticated && user && adminPermission) {
        try {
          const response = await getJson(
            `${import.meta.env.API_BASE_URL}/v1/channels`,
          ) as APIResponse<ChannelsListResponse>;
          if (response.data) {
            setChannels(response.data);
          }
          console.log("API Channels:", channels);
        } catch (error) {
          console.error("API Error:", error);
        }
      } else {
        console.warn("User is not authenticated or does not have read permission");
      }
    };

    fetchData();
  }, [isAuthenticated, user]);

  const searchInput = (
    <Input
      aria-label={t("search")}
      classNames={{
        inputWrapper: "bg-default-100",
        input: "text-sm",
      }}
      endContent={
        <Kbd className="hidden lg:inline-block" keys={["command"]}>
          K
        </Kbd>
      }
      labelPlacement="outside"
      placeholder={`${t("search")}…`}
      startContent={
        <SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0" />
      }
      type="search"
    />
  );

  return (
    <HeroUINavbar maxWidth="xl" position="sticky">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 max-w-fit">
          <Link
            className="flex justify-start items-center gap-1"
            color="foreground"
            href="/"
          >
            <Logo />
            <p className="font-bold text-inherit">{siteConfig().name}</p>
          </Link>
        </NavbarBrand>
        <div className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig().navItems.map((item) => (
            <NavbarItem key={item.href} className="hidden sm:flex">
              <Link
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                color="foreground"
                href={item.href}
              >
                {item.label}
              </Link>
            </NavbarItem>
          ))}
          {channels && (channels.total_count > 0) && (
            <NavbarItem>
              <Dropdown>
                <DropdownTrigger>
                  <Link
                    className={clsx(
                      linkStyles({ color: "foreground" }),
                      "data-[active=true]:text-primary data-[active=true]:font-medium",
                    )}
                  >
                    {channels.total_count === 1 ? t("channel") : t("channels")}
                  </Link>
                </DropdownTrigger>
                <DropdownMenu aria-label="Channels">
                  <DropdownSection title={t("channels")} showDivider={isAdminUser}>
                    {channels.channels.map((channel) => (
                      <DropdownItem key={channel.uuid} textValue={channel.name}>
                        <Link
                          href={`/channel/${channel.uuid}`}
                          color="foreground"
                        >
                          {channel.name}
                        </Link>
                      </DropdownItem>
                    ))}
                  </DropdownSection>
                  {isAdminUser ? (
                    <DropdownSection title={t("channels_administration")}>
                      <DropdownItem key="admin" textValue={t("channels_administration")}>
                        <Link
                          href="/channels-admin"
                          color="foreground"
                        >
                          {t("channels_administration")}
                        </Link>
                      </DropdownItem>
                    </DropdownSection>
                  ) : null}
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          )}
        </div>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <Link
            isExternal
            href={siteConfig().links.twitter}
            title={t("twitter")}
          >
            <TwitterIcon className="text-default-500" />
          </Link>
          <Link
            isExternal
            href={siteConfig().links.discord}
            title={t("discord")}
          >
            <DiscordIcon className="text-default-500" />
          </Link>
          <Link isExternal href={siteConfig().links.github} title={t("github")}>
            <GithubIcon className="text-default-500" />
          </Link>
          <ThemeSwitch />
          <LanguageSwitch
            availableLanguages={availableLanguages}
            icon={I18nIcon}
          />
          <LoginLogoutButton />
        </NavbarItem>
        <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem>
        <NavbarItem className="hidden md:flex">
          <Button
            isExternal
            as={Link}
            className="text-sm font-normal text-default-600 bg-default-100"
            href={siteConfig().links.sponsor}
            startContent={<HeartFilledIcon className="text-danger" />}
            variant="flat"
          >
            <Trans i18nKey="sponsor" />
          </Button>
        </NavbarItem>
      </NavbarContent>

      {/* Mobile Navbar */}
      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <Link isExternal href={siteConfig().links.github}>
          <GithubIcon className="text-default-500" />
        </Link>
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        {searchInput}
        <LanguageSwitch
          availableLanguages={availableLanguages}
          icon={I18nIcon}
        />
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig().navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                color={
                  index === 2
                    ? "primary"
                    : index === siteConfig().navMenuItems.length - 1
                      ? "danger"
                      : "foreground"
                }
                href={item.href}
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
          {channels && (channels.total_count > 0) && (
            <NavbarMenuItem key="channels-dropdown">
              <div className="flex flex-col gap-2 w-full">
                <p className="text-large">
                  {channels.total_count === 1 ? t("channel") : t("channels")}
                </p>
                {channels.channels.map((channel) => (
                  <Link
                    key={channel.uuid}
                    href={`/channel/${channel.uuid}`}
                    color="foreground"
                    size="lg"
                    className="pl-4"
                  >
                    {channel.name}
                  </Link>
                ))}
                {isAdminUser && (
                  <>
                    <div className="border-t border-divider mt-2 pt-2">
                      <p className="text-large">
                        {t("channels_administration")}
                      </p>
                      <Link
                        href="/channels-admin"
                        color="foreground"
                        size="lg"
                        className="pl-4"
                      >
                        {t("channels_administration")}
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </NavbarMenuItem>
          )}
          <NavbarMenuItem key="login-logout">
            <LoginLogoutLink color="primary" />
          </NavbarMenuItem>
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
