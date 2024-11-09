cmake_minimum_required(VERSION 3.19)
project(MyProject VERSION 1.0)

# Define the executable
add_executable(MyProject src/main.cpp)

# Optionally, link any libraries and set properties
# target_link_libraries(MyProject <library_name>)
# target_compile_features(MyProject PUBLIC cxx_std_11)

# Define test executable
add_executable(MyProjectTests src/main.cpp)

# Enable testing
include(CTest)
add_test(NAME MyProjectTest COMMAND MyProjectTests)

# Packaging configuration
#include(GNUInstallDirs)
#install(TARGETS MyProject DESTINATION ${CMAKE_INSTALL_BINDIR})
