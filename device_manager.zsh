#!/bin/zsh

#################################################################################
# iOS & Android Device Manager Script
# 
# Description: Manages iOS devices/simulators and Android emulators for app 
#              installation/uninstallation with enhanced UI using fzf
# Author: Adam Ferreira
# Version: 2.0
#################################################################################

#################################################################################
# CONFIGURATION & CONSTANTS
#################################################################################


# iOS Device Configurations
declare -A REAL_DEVICES
REAL_DEVICES["iPhone 13 mini"]="00008110-001A4DDE3A62401E"

declare -A SIMULATORS
SIMULATORS["iPhone 16"]="B051E998-AF14-4DA1-81CF-EA31B522DF9B"

# Android Device Configurations
declare -A ANDROID_EMULATORS
ANDROID_EMULATORS["Pixel 9"]="Pixel_9"

declare -A ANDROID_REAL_DEVICES
ANDROID_REAL_DEVICES["Android Device"]="37261FDJH0090W"


# Application Paths - Accor Sandbox (iOS)
readonly ACCOR_SANDBOX_APP_PATH="/Users/adamferreira/Library/Developer/Xcode/DerivedData/AccorHotelsApp-evhrwvaukduphycffipdcedfbjmt/Build/Products/SandboxDevelopmentDebug-iphonesimulator/AccorHotelsApp.app"
readonly ACCOR_SANDBOX_BUNDLE_ID="fr.accor.push.sandbox"

# Application Paths - Accor iOS Store App
readonly ACCOR_IOS_STORE_APP_PATH="/Users/adamferreira/Library/Developer/Xcode/DerivedData/AccorHotelsApp-evhrwvaukduphycffipdcedfbjmt/Build/Products/Store-iphonesimulator/AccorHotelsApp.app"
readonly ACCOR_IOS_STORE_BUNDLE_ID="fr.accor.push"

# Application Paths - Accor Inhouse (Android)
readonly ACCOR_INHOUSE_BUNDLE_ID="com.accor.appli.hybrid.inhouse"

# Application Paths - Accor Android Store App
readonly ACCOR_ANDROID_STORE_BUNDLE_ID="com.accor.appli.hybrid"


# System Paths
readonly ANDROID_SDK_PATH="$HOME/Library/Android/sdk"
readonly ADB_PATH="$ANDROID_SDK_PATH/platform-tools/adb"
readonly EMULATOR_PATH="$ANDROID_SDK_PATH/emulator/emulator"

# Devices that should skip appVersion capability
readonly -a NO_APPVERSION_IOS_DEVICES=("iPhone 13 mini" "iPhone 13 Pro Max" "iPhone 16")
readonly -a NO_APPVERSION_ANDROID_DEVICES=("Pixel 8" "Simulator - Pixel 9" "Pixel 9")

#################################################################################
# UTILITY FUNCTIONS
#################################################################################

# Display Functions for Enhanced UI

print_section() {
    echo "\n$1"
    echo "$(printf '%.0s-' {1..${#1}})"
}

print_success() {
    echo "✓ $1"
}

print_error() {
    echo "✗ $1"
}

print_warning() {
    echo "⚠ $1"
}

print_info() {
    echo "ℹ $1"
}

# System Check Functions
check_fzf() {
    command -v fzf &>/dev/null
}

check_prerequisites() {
    local ios_available=true
    local android_available=true

    # Check fzf requirement
    if ! check_fzf; then
        print_error "fzf is required for this script to function."
        print_info "Install fzf: brew install fzf"
        exit 1
    fi

    # Check iOS tools
    if ! command -v xcrun &>/dev/null; then
        print_error "xcrun not found. iOS functionality will be unavailable."
        ios_available=false
    fi

    # Check Android tools
    if ! command -v "$ADB_PATH" &>/dev/null; then
        print_error "adb not found. Android functionality will be unavailable."
        print_info "Install Android SDK Platform Tools to enable Android features."
        android_available=false
    fi

    if ! command -v "$EMULATOR_PATH" &>/dev/null; then
        print_error "emulator command not found. Android emulator management will be limited."
        print_info "Make sure Android SDK is properly installed and emulator is in PATH."
    fi

    # Report results
    if $ios_available && $android_available; then
        print_success "Prerequisites check passed - iOS & Android supported (fzf mode)"
    elif $ios_available; then
        print_warning "Prerequisites check passed - iOS only (Android tools missing)"
    elif $android_available; then
        print_warning "Prerequisites check passed - Android only (iOS tools missing)"
    else
        print_error "Neither iOS nor Android tools are available. Please install the required SDKs."
        exit 1
    fi
}

# Device Version Check Helper
should_skip_app_version() {
    local device_name=$1
    local platform=$2
    
    case $platform in
        "ios")
            for device in "${NO_APPVERSION_IOS_DEVICES[@]}"; do
                if [[ "$device_name" == "$device" ]]; then
                    return 0  # Skip version
                fi
            done
            ;;
        "android")
            for device in "${NO_APPVERSION_ANDROID_DEVICES[@]}"; do
                if [[ "$device_name" == "$device" ]]; then
                    return 0  # Skip version
                fi
            done
            ;;
    esac
    return 1  # Don't skip version
}

#################################################################################
# iOS DEVICE MANAGEMENT FUNCTIONS
#################################################################################

# Install application on iOS real device
install_app_real_device() {
    local device_id=$1
    local app_path=$2
    local device_name=$3

    print_info "Installing app on $device_name..."

    # Validate app path exists
    if [[ ! -f "$app_path" && ! -d "$app_path" ]]; then
        print_error "App path does not exist: $app_path"
        return 1
    fi

    # Check if device should skip appVersion capability
    if should_skip_app_version "$device_name" "ios"; then
        print_info "Skipping appVersion capability for $device_name (as requested)"
    fi

    # Install app using devicectl
    if xcrun devicectl device install app --device "$device_id" "$app_path"; then
        print_success "App installed successfully on $device_name"
        return 0
    else
        print_error "Failed to install app on $device_name"
        return 1
    fi
}

# Uninstall application from iOS real device
uninstall_app_real_device() {
    local device_id=$1
    local bundle_id=$2
    local device_name=$3

    print_info "Uninstalling $bundle_id from $device_name..."

    if xcrun devicectl device uninstall app --device "$device_id" "$bundle_id"; then
        print_success "App uninstalled successfully from $device_name"
        return 0
    else
        print_error "Failed to uninstall app from $device_name"
        return 1
    fi
}

# Install application on iOS simulator
install_app_simulator() {
    local sim_id=$1
    local app_path=$2
    local sim_name=$3

    print_info "Installing app on $sim_name simulator..."

    # Validate app path exists
    if [[ ! -f "$app_path" && ! -d "$app_path" ]]; then
        print_error "App path does not exist: $app_path"
        return 1
    fi

    # Check if device should skip appVersion capability
    if should_skip_app_version "$sim_name" "ios"; then
        print_info "Skipping appVersion capability for $sim_name (as requested)"
    fi

    # Boot simulator if not already booted
    xcrun simctl boot "$sim_id" 2>/dev/null || true

    # Install app on simulator
    if xcrun simctl install "$sim_id" "$app_path"; then
        print_success "App installed successfully on $sim_name simulator"
        return 0
    else
        print_error "Failed to install app on $sim_name simulator"
        return 1
    fi
}

# Uninstall application from iOS simulator
uninstall_app_simulator() {
    local sim_id=$1
    local bundle_id=$2
    local sim_name=$3

    print_info "Uninstalling $bundle_id from $sim_name simulator..."

    if xcrun simctl uninstall "$sim_id" "$bundle_id"; then
        print_success "App uninstalled successfully from $sim_name simulator"
        return 0
    else
        print_error "Failed to uninstall app from $sim_name simulator"
        return 1
    fi
}

#################################################################################
# ANDROID DEVICE MANAGEMENT FUNCTIONS
#################################################################################

# Install application on Android emulator
install_app_android_emulator() {
    local emulator_name=$1
    local apk_path=$2

    print_info "Installing app on $emulator_name Android emulator..."

    # Validate APK path exists
    if [[ ! -f "$apk_path" ]]; then
        print_error "APK path does not exist: $apk_path"
        return 1
    fi

    # Get the emulator device ID for adb targeting
    local emulator_device_id
    emulator_device_id=$("$ADB_PATH" devices | grep emulator | head -1 | awk '{print $1}')
    
    if [[ -z "$emulator_device_id" ]]; then
        print_error "No Android emulator found running"
        return 1
    fi

    # Install APK on emulator (try multiple approaches for storage issues)
    print_info "Attempting to install APK..."
    
    # First try: Standard installation
    if "$ADB_PATH" -s "$emulator_device_id" install "$apk_path" 2>/dev/null; then
        print_success "App installed successfully on $emulator_name ($emulator_device_id)"
        return 0
    fi
    
    # Second try: Install with replace existing and external storage flags
    print_info "Standard install failed, trying with replace and external storage flags..."
    if "$ADB_PATH" -s "$emulator_device_id" install -r -s "$apk_path" 2>/dev/null; then
        print_success "App installed successfully on $emulator_name ($emulator_device_id) using external storage"
        return 0
    fi
    
    # Third try: Force replace
    print_info "Trying to uninstall existing app first, then reinstall..."
    "$ADB_PATH" -s "$emulator_device_id" uninstall "$ACCOR_INHOUSE_BUNDLE_ID" 2>/dev/null || true
    if "$ADB_PATH" -s "$emulator_device_id" install "$apk_path" 2>/dev/null; then
        print_success "App installed successfully on $emulator_name ($emulator_device_id) after uninstall"
        return 0
    fi
    
    print_error "Failed to install app on $emulator_name"
    print_info "Try the following to resolve storage issues:"
    print_info "1. Free up space on the emulator by uninstalling other apps"
    print_info "2. Wipe the emulator data and restart it"
    print_info "3. Create a new emulator with more internal storage"
    return 1
}

# Uninstall application from Android emulator
uninstall_app_android_emulator() {
    local emulator_name=$1
    local package_name=$2

    print_info "Uninstalling $package_name from $emulator_name Android emulator..."

    # Get the emulator device ID for adb targeting
    local emulator_device_id
    emulator_device_id=$("$ADB_PATH" devices | grep emulator | head -1 | awk '{print $1}')
    
    if [[ -z "$emulator_device_id" ]]; then
        print_error "No Android emulator found running"
        return 1
    fi

    if "$ADB_PATH" -s "$emulator_device_id" uninstall "$package_name"; then
        print_success "App uninstalled successfully from $emulator_name ($emulator_device_id)"
        return 0
    else
        print_error "Failed to uninstall app from $emulator_name"
        return 1
    fi
}

# Install application on Android real device
install_app_android_real_device() {
    local device_name=$1
    local apk_path=$2

    print_info "Installing app on $device_name Android real device..."

    # Validate APK path exists
    if [[ ! -f "$apk_path" ]]; then
        print_error "APK path does not exist: $apk_path"
        return 1
    fi

    # Install APK on real device (try multiple approaches for storage issues)
    print_info "Attempting to install APK..."
    
    # First try: Standard installation
    if "$ADB_PATH" -s "$selected_android_real_device_id" install "$apk_path" 2>/dev/null; then
        print_success "App installed successfully on $device_name"
        return 0
    fi
    
    # Second try: Install with replace existing and external storage flags
    print_info "Standard install failed, trying with replace and external storage flags..."
    if "$ADB_PATH" -s "$selected_android_real_device_id" install -r -s "$apk_path" 2>/dev/null; then
        print_success "App installed successfully on $device_name using external storage"
        return 0
    fi
    
    # Third try: Force replace
    print_info "Trying to uninstall existing app first, then reinstall..."
    "$ADB_PATH" -s "$selected_android_real_device_id" uninstall "$ACCOR_INHOUSE_BUNDLE_ID" 2>/dev/null || true
    if "$ADB_PATH" -s "$selected_android_real_device_id" install "$apk_path" 2>/dev/null; then
        print_success "App installed successfully on $device_name after uninstall"
        return 0
    fi
    
    print_error "Failed to install app on $device_name"
    print_info "Try the following to resolve storage issues:"
    print_info "1. Free up space on the device by uninstalling other apps"
    print_info "2. Move apps to external storage if available"
    print_info "3. Clear cache and data from existing apps"
    return 1
}

# Uninstall application from Android real device
uninstall_app_android_real_device() {
    local device_name=$1
    local package_name=$2

    print_info "Uninstalling $package_name from $device_name Android real device..."

    if "$ADB_PATH" -s "$selected_android_real_device_id" uninstall "$package_name"; then
        print_success "App uninstalled successfully from $device_name"
        return 0
    else
        print_error "Failed to uninstall app from $device_name"
        return 1
    fi
}
#################################################################################
# DEVICE CONNECTION & STATUS FUNCTIONS
#################################################################################

# Check device connections using unified command
check_device_connections() {
    print_section "Device Connection Status"
    print_info "Checking connected devices and booted simulators..."

    echo "\niOS Devices & Simulators:"
    if ios-deploy -c && xcrun simctl list devices | grep "Booted"; then
        echo "iOS devices accessible"
    else
        print_warning "Some iOS devices may not be accessible"
    fi

    echo "\nAndroid Emulators:"
    if command -v "$ADB_PATH" &>/dev/null; then
        "$ADB_PATH" devices
    else
        print_warning "adb not found - Android functionality unavailable"
    fi

    return 0
}



# Boot Android emulator
boot_android_emulator() {
    local emulator_id=$1
    local emulator_name=$2

    print_info "Starting $emulator_name Android emulator..."

    # Set Android SDK environment variables
    export ANDROID_SDK_ROOT="$ANDROID_SDK_PATH"
    export ANDROID_HOME="$ANDROID_SDK_PATH"

    # Start emulator in background with no output
    "$EMULATOR_PATH" "@$emulator_id" > /dev/null 2>&1 &
    local emulator_pid=$!

    print_success "$emulator_name emulator starting (PID: $emulator_pid)"
    print_info "Emulator is starting in the background. It may take a few minutes to fully boot."

    return 0
}

# Shutdown Android emulator
quit_android_emulator() {
    local emulator_name=$1

    print_info "Shutting down $emulator_name Android emulator..."

    # Get the emulator device ID for adb targeting
    local emulator_device_id
    emulator_device_id=$("$ADB_PATH" devices | grep emulator | head -1 | awk '{print $1}')
    
    if [[ -z "$emulator_device_id" ]]; then
        print_error "No Android emulator found running"
        return 1
    fi

    if "$ADB_PATH" -s "$emulator_device_id" emu kill; then
        print_success "$emulator_name emulator shut down successfully"
        return 0
    else
        print_warning "Failed to shut down emulator via adb. You may need to close it manually."
        return 1
    fi
}


#################################################################################
# USER INPUT & FILE SELECTION FUNCTIONS
#################################################################################

# fzf-based menu function
fzf_menu() {
    local title=$1
    shift
    local options=("$@")

    printf '%s\n' "${options[@]}" | fzf \
        --prompt="$title > " \
        --height=40% \
        --border \
        --reverse \
        --info=inline \
        --header="$title" \
        --header-lines=0
}

# fzf-based real device selection
fzf_select_real_device() {
    if [[ ${#REAL_DEVICES[@]} -eq 0 ]]; then
        print_error "No real devices configured"
        return 1
    fi

    local -a device_options
    for device_name in ${(k)REAL_DEVICES}; do
        device_options+=("$device_name")
    done

    local selection
    selection=$(printf '%s\n' "${device_options[@]}" | fzf \
        --prompt="Select iOS Real Device > " \
        --height=40% \
        --border \
        --reverse \
        --header="iOS Real Devices")

    if [[ -n "$selection" ]]; then
        selected_device="$selection"
        selected_device_id="${REAL_DEVICES[$selection]}"
        print_info "Selected: $selected_device (ID: $selected_device_id)"
        return 0
    else
        return 1
    fi
}

# fzf-based simulator selection
fzf_select_simulator() {
    if [[ ${#SIMULATORS[@]} -eq 0 ]]; then
        print_error "No simulators configured"
        return 1
    fi

    local -a sim_options
    for sim_name in ${(k)SIMULATORS}; do
        sim_options+=("$sim_name")
    done

    local selection
    selection=$(printf '%s\n' "${sim_options[@]}" | fzf \
        --prompt="Select iOS Simulator > " \
        --height=40% \
        --border \
        --reverse \
        --header="iOS Simulators")

    if [[ -n "$selection" ]]; then
        selected_simulator="$selection"
        selected_simulator_id="${SIMULATORS[$selection]}"
        print_info "Selected: $selected_simulator (ID: $selected_simulator_id)"
        return 0
    else
        return 1
    fi
}

# fzf-based Android emulator selection
fzf_select_android_emulator() {
    if [[ ${#ANDROID_EMULATORS[@]} -eq 0 ]]; then
        print_error "No Android emulators configured"
        return 1
    fi

    local -a emulator_options
    for emulator_name in ${(k)ANDROID_EMULATORS}; do
        emulator_options+=("$emulator_name")
    done

    local selection
    selection=$(printf '%s\n' "${emulator_options[@]}" | fzf \
        --prompt="Select Android Emulator > " \
        --height=40% \
        --border \
        --reverse \
        --header="Android Emulators")

    if [[ -n "$selection" ]]; then
        selected_android_emulator="$selection"
        selected_android_emulator_id="${ANDROID_EMULATORS[$selection]}"
        print_info "Selected: $selected_android_emulator (ID: $selected_android_emulator_id)"
        return 0
    else
        return 1
    fi
}

# fzf-based Android real device selection
fzf_select_android_real_device() {
    if [[ ${#ANDROID_REAL_DEVICES[@]} -eq 0 ]]; then
        print_error "No Android real devices configured"
        return 1
    fi

    local -a device_options
    for device_name in ${(k)ANDROID_REAL_DEVICES}; do
        device_options+=("$device_name")
    done

    local selection
    selection=$(printf '%s\n' "${device_options[@]}" | fzf \
        --prompt="Select Android Real Device > " \
        --height=40% \
        --border \
        --reverse \
        --header="Android Real Devices")

    if [[ -n "$selection" ]]; then
        selected_android_real_device="$selection"
        selected_android_real_device_id="${ANDROID_REAL_DEVICES[$selection]}"
        print_info "Selected: $selected_android_real_device (ID: $selected_android_real_device_id)"
        return 0
    else
        return 1
    fi
}

# Legacy functions for compatibility (redirect to fzf versions)
select_real_device() {
    fzf_select_real_device
}

select_simulator() {
    fzf_select_simulator
}

select_android_emulator() {
    fzf_select_android_emulator
}

# Select APK file from Downloads folder
select_apk_from_downloads() {
    local downloads_path="$HOME/Downloads"
    
    if [[ ! -d "$downloads_path" ]]; then
        print_error "Downloads folder not found: $downloads_path"
        return 1
    fi

    # Find all APK files in Downloads
    local -a apk_files
    apk_files=($(find "$downloads_path" -name "*.apk" -type f 2>/dev/null))
    
    if [[ ${#apk_files[@]} -eq 0 ]]; then
        print_warning "No APK files found in Downloads folder"
        return 1
    fi

    # Prepare options with just filenames
    local -a apk_options
    for apk_file in "${apk_files[@]}"; do
        apk_options+=("$(basename "$apk_file")")
    done

    # Present fzf selection interface
    local selection
    selection=$(printf '%s\n' "${apk_options[@]}" | fzf --prompt="Select APK > " --height=40% --border --reverse)

    if [[ -n "$selection" ]]; then
        selected_apk_path="$downloads_path/$selection"
        return 0
    else
        return 1
    fi
}



# iOS Real Device Management Menu
real_device_menu() {
    while true; do
        local options=(
            "Uninstall Accor Sandbox"
            "Uninstall Accor iOS Store App"
            "Back to main menu"
        )

        local choice=$(fzf_menu "Real Device Management" "${options[@]}")

        if [[ -z "$choice" ]]; then
            break
        fi

        case $choice in
        "Uninstall Accor Sandbox")
            if select_real_device; then
                uninstall_app_real_device "$selected_device_id" "$ACCOR_SANDBOX_BUNDLE_ID" "$selected_device"
            fi
            ;;
        "Uninstall Accor iOS Store App")
            if select_real_device; then
                uninstall_app_real_device "$selected_device_id" "$ACCOR_IOS_STORE_BUNDLE_ID" "$selected_device"
            fi
            ;;
        "Back to main menu")
            break
            ;;
        esac

        # Pause for user to see results
        echo "\nPress Enter to continue..."
        read
    done
}

# iOS Simulator Management Menu
simulator_menu() {
    while true; do
        local options=(
            "Install Accor Sandbox"
            "Uninstall Accor Sandbox"
            "Install Accor iOS Store App"
            "Uninstall Accor iOS Store App"
            "Boot simulator"
            "Quit simulator"
            "Back to main menu"
        )

        local choice=$(fzf_menu "iOS Simulator Management" "${options[@]}")

        if [[ -z "$choice" ]]; then
            break
        fi

        case $choice in
        "Install Accor Sandbox")
            if select_simulator; then
                install_app_simulator "$selected_simulator_id" "$ACCOR_SANDBOX_APP_PATH" "$selected_simulator"
            fi
            ;;
        "Uninstall Accor Sandbox")
            if select_simulator; then
                uninstall_app_simulator "$selected_simulator_id" "$ACCOR_SANDBOX_BUNDLE_ID" "$selected_simulator"
            fi
            ;;
        "Install Accor iOS Store App")
            if select_simulator; then
                install_app_simulator "$selected_simulator_id" "$ACCOR_IOS_STORE_APP_PATH" "$selected_simulator"
            fi
            ;;
        "Uninstall Accor iOS Store App")
            if select_simulator; then
                uninstall_app_simulator "$selected_simulator_id" "$ACCOR_IOS_STORE_BUNDLE_ID" "$selected_simulator"
            fi
            ;;
        "Boot simulator")
            if select_simulator; then
                print_info "Booting $selected_simulator simulator..."
                if xcrun simctl boot "$selected_simulator_id"; then
                    print_success "$selected_simulator simulator booted successfully"
                else
                    print_warning "$selected_simulator simulator may already be booted"
                fi
            fi
            ;;
        "Quit simulator")
            if select_simulator; then
                print_info "Shutting down $selected_simulator simulator..."
                if xcrun simctl shutdown "$selected_simulator_id"; then
                    print_success "$selected_simulator simulator shut down successfully"
                else
                    print_warning "$selected_simulator simulator may already be shut down"
                fi
            fi
            ;;
        "Back to main menu")
            break
            ;;
        esac

        # Pause for user to see results
        echo "\nPress Enter to continue..."
        read
    done
}

# Android Emulator Management Menu
android_emulator_menu() {
    while true; do
        local options=(
            "Install APK from Downloads"
            "Uninstall Accor Inhouse"
            "Uninstall Accor Android Store App"
            "Boot emulator"
            "Quit emulator"
            "Back to main menu"
        )

        local choice=$(fzf_menu "Android Emulator Management" "${options[@]}")

        if [[ -z "$choice" ]]; then
            break
        fi

        case $choice in
        "Install APK from Downloads")
            if select_android_emulator && select_apk_from_downloads; then
                install_app_android_emulator "$selected_android_emulator" "$selected_apk_path"
            fi
            ;;
        "Uninstall Accor Inhouse")
            if select_android_emulator; then
                uninstall_app_android_emulator "$selected_android_emulator" "$ACCOR_INHOUSE_BUNDLE_ID"
            fi
            ;;
        "Uninstall Accor Android Store App")
            if select_android_emulator; then
                uninstall_app_android_emulator "$selected_android_emulator" "$ACCOR_ANDROID_STORE_BUNDLE_ID"
            fi
            ;;
        "Boot emulator")
            if select_android_emulator; then
                boot_android_emulator "$selected_android_emulator_id" "$selected_android_emulator"
            fi
            ;;
        "Quit emulator")
            if select_android_emulator; then
                quit_android_emulator "$selected_android_emulator"
            fi
            ;;
        "Back to main menu")
            break
            ;;
        esac

        # Pause for user to see results
        echo "\nPress Enter to continue..."
        read
    done
}

# Android Real Device Management Menu
android_real_device_menu() {
    while true; do
        local options=(
            "Install APK from Downloads"
            "Uninstall Accor Inhouse"
            "Uninstall Accor Android Store App"
            "Back to main menu"
        )

        local choice=$(fzf_menu "Android Real Device Management" "${options[@]}")

        if [[ -z "$choice" ]]; then
            break
        fi

        case $choice in
        "Install APK from Downloads")
            if fzf_select_android_real_device && select_apk_from_downloads; then
                install_app_android_real_device "$selected_android_real_device" "$selected_apk_path"
            fi
            ;;
        "Uninstall Accor Inhouse")
            if fzf_select_android_real_device; then
                uninstall_app_android_real_device "$selected_android_real_device" "$ACCOR_INHOUSE_BUNDLE_ID"
            fi
            ;;
        "Uninstall Accor Android Store App")
            if fzf_select_android_real_device; then
                uninstall_app_android_real_device "$selected_android_real_device" "$ACCOR_ANDROID_STORE_BUNDLE_ID"
            fi
            ;;
        "Back to main menu")
            break
            ;;
        esac

        # Pause for user to see results
        echo "\nPress Enter to continue..."
        read
    done
}


# Primary Application Menu
main_menu() {
    while true; do

        local options=(
            "Manage iOS Real Devices"
            "Manage iOS Simulators"
            "Manage Android Emulators"
            "Manage Android Real Devices"
            "Show all devices/simulators/emulators"
            "Exit"
        )

        local choice=$(fzf_menu "iOS & Android Device Manager - Main Menu" "${options[@]}")

        if [[ -z "$choice" ]]; then
            print_success "Goodbye!"
            exit 0
        fi

        case $choice in
        "Manage iOS Real Devices")
            real_device_menu
            ;;
        "Manage iOS Simulators")
            simulator_menu
            ;;
        "Manage Android Emulators")
            android_emulator_menu
            ;;
        "Manage Android Real Devices")
            android_real_device_menu
            ;;
        "Show all devices/simulators/emulators")
            check_device_connections
            echo -e "\nPress Enter to continue..."
            read
            ;;
        "Exit")
            print_success "Goodbye!"
            exit 0
            ;;
        esac
    done
}

#################################################################################
# MAIN EXECUTION
#################################################################################

# Application entry point
main() {
    check_prerequisites
    main_menu
}

# Execute the script with all provided arguments
main "$@"
